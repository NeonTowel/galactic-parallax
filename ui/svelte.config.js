import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter({
			// Defaults to 'build', but you can set your own directory if you want
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html' // for SPA routing
		})
	}
};
