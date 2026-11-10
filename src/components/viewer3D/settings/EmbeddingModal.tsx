import { useEffect, useMemo, useState } from 'react';
import { XIcon } from '@heroicons/react/solid';

import { formatVector, type EmbeddingSource } from '../../../lib/utils/embeddings';

interface EmbeddingModalProps {
	onClose: () => void;
	meshName: string;
	labelValue: number;
	featureId?: string;
	embeddings: EmbeddingSource;
}

type VectorState =
	| { status: 'loading' }
	| { status: 'ready'; vector: Float32Array }
	| { status: 'error'; message: string };

const CopyButton = ({ text, label }: { text: string; label: string }) => {
	const [feedback, setFeedback] = useState<string | null>(null);

	useEffect(() => {
		if (!feedback) return;
		const timeout = setTimeout(() => setFeedback(null), 1500);
		return () => clearTimeout(timeout);
	}, [feedback]);

	return (
		<button
			type="button"
			onClick={() =>
				navigator.clipboard
					.writeText(text)
					.then(() => setFeedback('Copied'), () => setFeedback('Copy failed'))
			}
			className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
		>
			{feedback ?? label}
		</button>
	);
};

/** Embedding model and vector of one selected glyph */
const EmbeddingModal = ({ onClose, meshName, labelValue, featureId, embeddings }: EmbeddingModalProps) => {
	const [state, setState] = useState<VectorState>({ status: 'loading' });

	useEffect(() => {
		let cancelled = false;
		setState({ status: 'loading' });
		embeddings.readRow(labelValue).then(
			(vector) => !cancelled && setState({ status: 'ready', vector }),
			(error) => {
				console.error(`❌ Failed to read embedding of label-value ${labelValue}:`, error);
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
			}
		);
		return () => {
			cancelled = true;
		};
	}, [embeddings, labelValue]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	// One text block instead of one element per value
	const formatted = useMemo(() => (state.status === 'ready' ? formatVector(state.vector) : ''), [state]);
	const fullPrecision = useMemo(() => (state.status === 'ready' ? Array.from(state.vector).join(', ') : ''), [state]);

	const rows: [string, React.ReactNode][] = [
		['Mesh', meshName],
		['label-value', labelValue],
		['feature_id', featureId ?? <span className="text-gray-400">not in properties</span>],
		['Model', embeddings.model ?? <span className="text-gray-400">unknown</span>],
		[
			'sha256',
			embeddings.sha256 ? (
				<span className="flex items-start gap-2">
					<code className="font-mono text-xs break-all select-all">{embeddings.sha256}</code>
					<CopyButton text={embeddings.sha256} label="Copy" />
				</span>
			) : (
				<span className="text-gray-400">not stored</span>
			),
		],
		['sha256 kind', embeddings.sha256_kind ?? <span className="text-gray-400">not stored</span>],
	];

	return (
		<div
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Glyph embedding"
				className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-2xl max-h-[90vh] flex flex-col text-gray-800"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-lg font-bold">Glyph embedding</h2>
					<button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
						<XIcon className="h-5 w-5" />
					</button>
				</div>

				<dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm mb-4">
					{rows.map(([term, value]) => (
						<div key={term} className="contents">
							<dt className="font-medium text-gray-600">{term}</dt>
							<dd className="min-w-0 break-words">{value}</dd>
						</div>
					))}
				</dl>

				<div className="flex justify-between items-center mb-1 text-sm">
					<span className="font-medium text-gray-600">
						Vector{state.status === 'ready' && ` (length ${state.vector.length})`}
					</span>
					{state.status === 'ready' && <CopyButton text={fullPrecision} label="Copy vector" />}
				</div>
				{state.status === 'loading' && <p className="text-sm text-gray-500">Loading embedding…</p>}
				{state.status === 'error' && (
					<p className="text-sm text-red-600 break-words">Could not read the embedding: {state.message}</p>
				)}
				{state.status === 'ready' && (
					<pre className="flex-1 min-h-0 overflow-auto bg-gray-50 border border-gray-200 rounded p-2 font-mono text-xs leading-5">
						{formatted}
					</pre>
				)}
			</div>
		</div>
	);
};

export default EmbeddingModal;
