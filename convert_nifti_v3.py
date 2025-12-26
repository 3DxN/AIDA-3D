import os
import shutil
import nibabel as nib
import numpy as np
import zarr
import zarrita
from ome_zarr.io import parse_url
from ome_zarr.writer import write_image

def convert(input_path, output_path):
    img = nib.load(input_path)
    data = img.get_fdata().astype(np.float32)
    data_min, data_max = float(np.min(data)), float(np.max(data))
    data = np.transpose(data, (2, 1, 0))
    zooms = img.header.get_zooms() 
    base_scale = [float(zooms[2]), float(zooms[1]), float(zooms[0])]
    temp_v2 = output_path + ".tmp_v2"
    if os.path.exists(temp_v2): shutil.rmtree(temp_v2)
    store_v2 = parse_url(temp_v2, mode="w").store
    root_v2 = zarr.group(store=store_v2)
    coordinate_transformations = []
    for i in range(5):
        coordinate_transformations.append([{"type": "scale", "scale": [s * (2**i) for s in base_scale]}])
    write_image(image=data, group=root_v2, axes="zyx", coordinate_transformations=coordinate_transformations, storage_options=dict(chunks=(64,64,64)))
    if os.path.exists(output_path): shutil.rmtree(output_path)
    os.makedirs(output_path, exist_ok=True)
    v3_store = zarrita.LocalStore(output_path)
    v3_group = zarrita.Group.create(v3_store)
    datasets = []
    for key in sorted(root_v2.array_keys()):
        v2_arr = root_v2[key]
        v3_arr = v3_group.create_array(key, shape=v2_arr.shape, chunk_shape=v2_arr.chunks, dtype=v2_arr.dtype, fill_value=0.0)
        v3_arr[:] = v2_arr[:]
        datasets.append({"path": key, "coordinateTransformations": [{"type": "scale", "scale": [s * (2**int(key)) for s in base_scale]}]})
    v3_group.update_attributes({
        "multiscales": [{"version": "0.5", "datasets": datasets, "type": "image", "axes": [{"name": "z", "type": "space", "unit": "millimeter"}, {"name": "y", "type": "space", "unit": "millimeter"}, {"name": "x", "type": "space", "unit": "millimeter"}]}],
        "omero": {"name": os.path.basename(input_path), "version": "0.5", "channels": [{"active": True, "color": "FFFFFF", "label": "Intensity", "window": {"start": data_min, "end": data_max * 0.8, "min": data_min, "max": data_max}}]}
    })
    shutil.rmtree(temp_v2)
    print(f"✅ Created: {output_path}")

if __name__ == "__main__":
    convert('newtask/FLAIR.nii.gz', 'newtask/FLAIR_v05.zarr')
