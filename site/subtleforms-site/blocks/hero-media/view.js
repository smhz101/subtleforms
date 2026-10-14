import { store, getElement } from '@wordpress/interactivity';

store( 'subtleforms/hero-media', {
	callbacks: {
		init() {
			const { ref } = getElement();
			const mp4 = ref.dataset.mp4;
			const webm = ref.dataset.webm;
			if ( ! mp4 && ! webm ) return;
			const reduced = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
			const saveData = navigator.connection && navigator.connection.saveData;
			if ( reduced || saveData ) return;
			const video = document.createElement( 'video' );
			video.className = 'sf-hero-media__video';
			video.muted = true;
			video.loop = true;
			video.playsInline = true;
			video.autoplay = true;
			video.setAttribute( 'muted', '' );
			video.setAttribute( 'playsinline', '' );
			video.setAttribute( 'aria-hidden', 'true' );
			video.preload = 'metadata';
			const poster = ref.querySelector( '.sf-hero-media__poster' );
			if ( poster ) video.poster = poster.currentSrc || poster.src;
			if ( webm ) { const s = document.createElement( 'source' ); s.src = webm; s.type = 'video/webm'; video.appendChild( s ); }
			if ( mp4 ) { const s = document.createElement( 'source' ); s.src = mp4; s.type = 'video/mp4'; video.appendChild( s ); }
			video.addEventListener( 'canplay', () => ref.classList.add( 'is-playing' ), { once: true } );
			ref.insertBefore( video, ref.firstChild );
			const play = video.play();
			if ( play && play.catch ) play.catch( () => {} );
		},
	},
} );
