import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// /api/slm is a dev/desktop-only route (it talks to a localhost
			// model server); it is intentionally absent from the static
			// build that Capacitor packages.
			strict: false
		})
	}
};

export default config;
