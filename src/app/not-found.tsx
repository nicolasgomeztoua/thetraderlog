import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
			<div className="text-center">
				<h1 className="font-bold font-mono text-6xl text-primary tracking-tighter">
					404
				</h1>
				<p className="mt-2 font-mono text-muted-foreground text-sm">
					Page not found. The route you requested does not exist.
				</p>
				<Link
					className="mt-6 inline-block border border-primary px-6 py-2.5 font-medium font-mono text-primary text-xs uppercase tracking-wider transition-colors hover:bg-primary hover:text-background"
					href="/dashboard"
				>
					Return to Dashboard
				</Link>
			</div>
		</div>
	);
}
