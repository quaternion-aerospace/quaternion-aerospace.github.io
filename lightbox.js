(function() {
"use strict";

////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARS
////////////////////////////////////////////////////////////////////////////////

// Classes
///////////

const LIGHTBOX_CLASS = "lightbox"; // root UI
const EXIT_CLASS = "lightbox_exit"; // exit control
const PREV_CLASS = "lightbox_prev"; // previous control
const NEXT_CLASS = "lightbox_next"; // next control
const SLIDE_CLASS = "lightbox_slide"; // image container
const LOW_IMG_CLASS = "lightbox_img_low"; // low-res slide image (thumbnail)
const HIGH_IMG_CLASS = "lightbox_img_high"; // high-res slide image

const CURRENT_CLASS = "current"; // marks the current slide
const C_WIDTH_CLASS = "constrainWidth"; // applied when image size should be limited by width
const C_HEIGHT_CLASS = "constrainHeight"; // applied when image size should be limited by height

const SHOWING_CLASS = "lightbox_showing"; // marks the image in the page that is being lightboxed

// State
/////////

let lightboxList = []; // keeps track of the images to show
let lightboxIndex = -1; // which image is currently showing
let imgRatio = 0; // width/height of the currently showing image
let widerWindow = true; // is the viewport aspect ratio higher than imgRatio?

// UI Elements
///////////////

// everything will be built inside this guy, and attahed/detached together
let lightbox = document.createElement('aside');
lightbox.className = LIGHTBOX_CLASS+' '+C_HEIGHT_CLASS;

function addControl(text, clazz) {
	let c = document.createElement('button');
	c.appendChild(document.createTextNode(text));
	c.className = clazz;
	lightbox.appendChild(c);
	return c;
}
let exit = addControl('✕', EXIT_CLASS); // to close the lightbox
let prev = addControl('‹', PREV_CLASS); // to go back one slide
let next = addControl('›', NEXT_CLASS); // to advance one slide

// slides will always be clones of this
let slideProto = document.createElement('section');
slideProto.className = SLIDE_CLASS;
[LOW_IMG_CLASS, HIGH_IMG_CLASS].forEach(function(res) {
	let i = document.createElement('img');
	i.className = res;
	slideProto.appendChild(i);
});

// make sure we can iterate HTMLCollection's
if (HTMLCollection.prototype[Symbol.iterator] === undefined) {
	HTMLCollection.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
}


////////////////////////////////////////////////////////////////////////////////
// EVENT LISTENERS
////////////////////////////////////////////////////////////////////////////////

// update widerWindow and the slide size constraints if the viewport resizes
window.addEventListener('resize', applyConstraint);

// when the lightbox gets to 0 opacity, detach it
lightbox.addEventListener('transitionend', () => {
	if (lightbox.style.opacity === "0") {
		detach();
	}
});

// any unhandled clicks on the lightbox close it
lightbox.addEventListener('click', function() {
	if (lightbox.ontransitionend !== undefined) { // if transitions supported
		lightbox.style.opacity = 0; // will detach() after transition
		let showing = document.querySelector(".lightbox_showing");
		if (showing) {
			// transition back to thumb
			let thumbRect = showing.getBoundingClientRect();
			showing.classList.remove("lightbox_showing");
			let imgs = Array.from(lightbox.querySelectorAll(".lightbox_slide.current img"));
			imgs.forEach(i => style(i, {
				top: (thumbRect.top + (thumbRect.height/2))+"px",
				left: (thumbRect.left + (thumbRect.width/2))+"px",
				transition: 'all 0.2s ease'
			}));
			if (widerWindow) {
				imgs.forEach(i => i.style.height = thumbRect.height+"px");
			} else {
				imgs.forEach(i => i.style.width = thumbRect.width+"px");
			}
		}
	} else {
		detach();
	}
});

// advance to next slide when the next button is clicked
next.addEventListener('click', function(evt) {
	evt.stopPropagation();
	let current = lightbox.querySelector(".current");
	let goTo = current.nextElementSibling;
	goTo.classList.add("current");
	current.classList.remove("current");
	lightboxIndex++;
	update();
});

// go back a slide when the prev button is clicked
prev.addEventListener('click', function(evt) {
	evt.stopPropagation();
	let current = lightbox.querySelector(".current");
	let goTo = current.previousElementSibling;
	goTo.classList.add("current");
	current.classList.remove("current");
	lightboxIndex--;
	update();
});

// bind keyboard controls
window.addEventListener('keydown', function(evt) {
	if (lightbox.parentNode !== null) {
		if (evt.keyCode === 27) exit.click(); // ESC
		else if (evt.keyCode == 39) next.click(); // right
		else if (evt.keyCode == 37) prev.click(); // left
	}
});

// open a lightbox instead of navigating when clicking on gallery items
document.querySelectorAll(".gallery").forEach(function (gallery) {
	gallery.addEventListener('click', function(evt) {
		let thumb = (evt.target.matches('img')) ? evt.target : evt.target.querySelector('img');
		if (thumb !== null && thumb.closest('a[href]') !== null) {
			evt.preventDefault();
			open(thumb);
		}
	});
});


////////////////////////////////////////////////////////////////////////////////
// SUPPORT FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

/**
 * Finds the max z-index currently in use on the page
 *
 * @return {string} a z-index CSS value
 */
function maxZ() {
	let max = "0";
	let toCheck = Array.from(document.body.children);
	for (let i=0; i<toCheck.length; i++) {
		let s = window.getComputedStyle(toCheck[i]);
		let z = s.zIndex;
		if (z !== "auto" && z > max) max = z;
		if (s.position === "static" && toCheck[i].children.length > 0) {
			toCheck.push.apply(toCheck, toCheck[i].children)
		}
	}
	return max;
}

/**
 * Helper for applying some inline CSS styles to an element
 *
 * @param  {Element} el the element to modify
 * @param  {Object} style property:value CSS rules
 */
function style(el, style) {
	for (let [prop, val] of Object.entries(style)) {
		el.style[prop] = val;
	}
}

/**
 * 'load' handler for the high-res image in a slide that will remove the
 * low-res image so that transparent graphics won't be doubled up.
 *
 * @param  {Event} evt an image load event
 */
function removeLowRes(evt) {
	let low = evt.target.closest('.'+SLIDE_CLASS).querySelector('.'+LOW_IMG_CLASS);
	if (low) {
		if (low.ontransitionend !== undefined) { // if transitions supported
			low.addEventListener('transitionend', () => {
				if (low.style.opacity === "0") low.remove();
			});
			low.style.opacity = 0;
		} else {
			low.remove();
		}
	}
}

/**
 * Detach the lightbox from the DOM and reset
 */
function detach() {
	document.body.style.overflow = 'auto';
	lightbox.remove();
	lightbox.style.opacity = null;
	for (let e of lightbox.querySelectorAll('.'+SLIDE_CLASS)) e.remove();
}

/**
 * Apply either a width or a height contraint to the current image, depending
 * on how its aspect ratio compares to the aspect ratio of the viewport.
 *
 * Relies on the global imgRatio being already set correctly.
 *
 * This gets called on window resize, so it needs to be as fast as possible!
 */
function applyConstraint() {
	let windowRatio = document.documentElement.clientWidth / document.documentElement.clientHeight;
	if (imgRatio > windowRatio) {
		if (widerWindow) {
			widerWindow = false;
			lightbox.classList.remove(C_HEIGHT_CLASS);
			lightbox.classList.add(C_WIDTH_CLASS);
		}
	}
	else {
		if (!widerWindow) {
			widerWindow = true;
			lightbox.classList.add(C_HEIGHT_CLASS);
			lightbox.classList.remove(C_WIDTH_CLASS);
		}
	}
}

/**
 * Update various bits in response to a new slide being shown.
 */
function update() {
	// update the class that indicates which gallery item is currently showing
	let old = document.querySelector('.'+SHOWING_CLASS);
	if (old !== null) old.classList.remove(SHOWING_CLASS);
	let current = lightboxList[lightboxIndex];
	current.classList.add(SHOWING_CLASS);
	// recompute the image ratio and apply appropriate size constriants
	imgRatio = current.width / current.height;
	applyConstraint();
	// disable/re-enable slide navigation buttons
	prev.disabled = !(lightbox.querySelector('.'+SLIDE_CLASS+' ~ .'+CURRENT_CLASS));
	next.disabled = !(lightbox.querySelector('.'+CURRENT_CLASS+' ~ .'+SLIDE_CLASS));
	// load the high-res image for this slide, if we haven't already
	let high = lightbox.querySelector('.'+CURRENT_CLASS+' .'+HIGH_IMG_CLASS);
	if (high.src === "") high.src = high.dataset.src;
}

/**
 * Open the lightbox
 *
 * @param  {Element} current a gallery thumbnail to expand in the lightbox
 */
function open(current) {
	// generate slides for all images in the same gallery
	lightboxList = current.closest(".gallery").querySelectorAll('a[href] img');
	for (let i=0; i<lightboxList.length; i++) {
		let slide = slideProto.cloneNode(true);
		let [low, high] = slide.children;
		low.src = lightboxList[i].src;
		high.addEventListener('load', removeLowRes);
		// save the high-res src to load later
		high.dataset.src = lightboxList[i].closest('a[href]').href;
		if (lightboxList[i] === current) {
			lightboxIndex = i;
			slide.classList.add("current");
			if (slide.ontransitionend !== undefined) { // if transitions supported
				// animate from the thumbnail
				let pos = current.getBoundingClientRect();
				for (let c of slide.children) {
					style(c, {
						top: (pos.top + (pos.height/2))+'px',
						left: (pos.left + (pos.width/2))+'px',
						height: pos.height+'px',
						width: pos.width+'px',
						transition: 'all 0.3s ease'
					});
					c.addEventListener('transitionend', () => c.style.transition = null);
				}
				// up to the normal fullscreen size
				requestAnimationFrame(() => {
					[low, high].forEach(e => {
						style(e, {
							top: null,
							left: null,
							height: null,
							width: null
						})
					});
				});
			}
			// load the current slide's high-res image immediately
			high.src = high.dataset.src;
		}
		lightbox.appendChild(slide);
	}
	// make sure the lightbox is the top-most element
	lightbox.style.zIndex = maxZ();
	// prevent scrolling behind
	document.body.style.overflow = 'hidden';
	// show it!
	update();
	document.body.appendChild(lightbox);
}

})();
