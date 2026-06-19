export default function AdminLoading() {
	return (
		<div className="flex h-screen items-center justify-center bg-background">
			<div className="flex flex-col items-center gap-4">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Verifying admin access...
				</span>
			</div>
		</div>
	);
}
