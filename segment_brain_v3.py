import os
import shutil
import nibabel as nib
import numpy as np
import zarrita
from scipy import ndimage
from skimage import segmentation, morphology, filters, feature

def segment(input_nifti, target_store_path, label_group_name, mode='coarse'):
    print(f"🔨 Generating {label_group_name}...")
    img = nib.load(input_nifti)
    data = img.get_fdata().astype(np.float32)
    denoised = ndimage.median_filter(data, size=3)
    
    # Mode-based segmentation for distinct sets
    if mode == 'coarse': # Anatomy
        thresh = filters.threshold_otsu(denoised[denoised > 0])
        binary = ndimage.binary_fill_holes(morphology.binary_closing(denoised > (thresh * 0.7), morphology.ball(3)))
        distance = ndimage.distance_transform_edt(binary)
        coords = feature.peak_local_max(distance, min_distance=40, labels=binary)
    elif mode == 'nuclei': # Cellpose (Simulated)
        thresh = filters.threshold_otsu(denoised[denoised > 0])
        binary = ndimage.binary_fill_holes(morphology.binary_closing(denoised > (thresh * 0.9), morphology.ball(1)))
        distance = ndimage.distance_transform_edt(binary)
        coords = feature.peak_local_max(distance, min_distance=10, labels=binary)
    else: # Fine Segments
        thresh = filters.threshold_triangle(denoised[denoised > 0])
        binary = ndimage.binary_fill_holes(morphology.binary_closing(denoised > (thresh * 1.1), morphology.ball(1)))
        distance = ndimage.distance_transform_edt(binary)
        coords = feature.peak_local_max(distance, min_distance=15, labels=binary)

    markers = np.zeros(distance.shape, dtype=bool)
    markers[tuple(coords.T)] = True
    markers, _ = ndimage.label(markers)
    labeled_mask = np.transpose(segmentation.watershed(-distance, markers, mask=binary), (2, 1, 0)).astype(np.uint32)
    
    base_scale = [float(s) for s in img.header.get_zooms()[::-1]]
    labels_path = os.path.join(target_store_path, 'labels', label_group_name)
    if os.path.exists(labels_path): shutil.rmtree(labels_path)
    os.makedirs(labels_path, exist_ok=True)
    
    cellpose_group = zarrita.Group.create(zarrita.LocalStore(labels_path))
    datasets = []
    current_data = labeled_mask
    for i in range(5):
        v3_arr = cellpose_group.create_array(str(i), shape=current_data.shape, chunk_shape=(64, 64, 64), dtype='uint32', fill_value=0)
        v3_arr[:] = current_data
        datasets.append({"path": str(i), "coordinateTransformations": [{"type": "scale", "scale": [s * (2**i) for s in base_scale]}]})
        if i < 4: current_data = current_data[::2, ::2, ::2]
    
    colors, properties = [], []
    for label_id in range(1, int(np.max(labeled_mask)) + 1):
        r, g, b = np.random.randint(60, 255, 3)
        colors.append({"label-value": int(label_id), "rgba": [int(r), int(g), int(b), 200]})
        properties.append({"label-value": int(label_id), "name": f"{label_group_name} {label_id}"})
    
    cellpose_group.update_attributes({
        "image-label": {"version": "0.5", "colors": colors, "properties": properties}, 
        "multiscales": [{"version": "0.5", "datasets": datasets, "axes": [{"name": "z", "type": "space", "unit": "millimeter"}, {"name": "y", "type": "space", "unit": "millimeter"}, {"name": "x", "type": "space", "unit": "millimeter"}], "type": "label"}]
    })
    print(f"✅ Created {label_group_name}")

if __name__ == "__main__":
    store_path = 'newtask/FLAIR_v05.zarr'
    segment('newtask/FLAIR.nii.gz', store_path, 'Anatomy', mode='coarse')
    segment('newtask/FLAIR.nii.gz', store_path, 'Segments', mode='fine')
    segment('newtask/FLAIR.nii.gz', store_path, 'Cellpose', mode='nuclei')