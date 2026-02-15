/**
 * Escape characters that are valid in markdown but break MDX compilation.
 * MDX treats `<` as JSX tag start and `{` as JSX expression start.
 * AI-generated prose often contains `<30%`, `<=`, `{some text}` etc.
 * We escape these while preserving code blocks and valid JSX components.
 */
export function sanitizeMdxProse(source: string): string {
	return source.replace(
		// Match code blocks (fenced or inline) first to skip them,
		// then match bare < not followed by valid JSX tag starts.
		// Our components are PascalCase, HTML tags are lowercase,
		// so only [a-zA-Z], /, !, > are valid after <
		/(```[\s\S]*?```|`[^`\n]+`)|<(?![a-zA-Z/!>])/g,
		(_match, codeBlock: string | undefined) => codeBlock ?? "&lt;",
	);
}
