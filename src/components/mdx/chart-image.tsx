"use client";

import { useState } from "react";

interface ChartImageProps {
	src: string;
	alt?: string;
	caption?: string;
}

export function ChartImage({ src, alt = "Chart", caption }: ChartImageProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<figure className="my-4">
				<button
					className="w-full cursor-zoom-in rounded border border-white/5 bg-white/[0.02] p-2 transition-colors hover:border-white/10"
					onClick={() => setIsOpen(true)}
					type="button"
				>
					{/* biome-ignore lint/performance/noImgElement: external AI-generated chart URLs */}
					<img alt={alt} className="w-full rounded" loading="lazy" src={src} />
				</button>
				{caption && (
					<figcaption className="mt-1.5 font-mono text-[10px] text-muted-foreground">
						{caption}
					</figcaption>
				)}
			</figure>

			{isOpen && (
				<button
					className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 backdrop-blur-sm"
					onClick={() => setIsOpen(false)}
					onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
					type="button"
				>
					<div className="max-h-[90vh] max-w-[90vw] overflow-auto">
						{/* biome-ignore lint/performance/noImgElement: external AI-generated chart URLs */}
						<img alt={alt} className="max-h-[90vh] w-auto" src={src} />
					</div>
				</button>
			)}
		</>
	);
}
