export {};

interface ClerkPublicMetadata {
	features?: {
		beta_access?: boolean;
	};
}

declare global {
	interface CustomJwtSessionClaims {
		metadata?: ClerkPublicMetadata;
	}
}

declare module "@clerk/types" {
	interface UserPublicMetadata extends ClerkPublicMetadata {}
}
