// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		/**
		 * File System Access, which the DOM library does not declare yet: it is
		 * Chromium only, so every call site has to check for it anyway.
		 */
		showDirectoryPicker?(options?: {
			mode?: 'read' | 'readwrite';
			id?: string;
		}): Promise<FileSystemDirectoryHandle>;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
