(function() {

// convert accordions to carousels
if (document.documentElement.clientWidth > 600) {
	document.querySelectorAll(".accordion.to-carousel").forEach(a => {
		a.classList.remove("accordion");
		a.classList.remove("to-carousel");
		a.classList.add("carousel");
	});
}

// only allow one accordion part to be open at a time
document.querySelectorAll(".accordion summary").forEach(s => {
	s.addEventListener('click', function() {
		let d = this.parentElement;
		this.closest(".accordion").querySelectorAll('details[open]')
			.forEach(details => {
				if (details !== d) details.open = false;
			});
	}, true);
});

// carousel <details> should always stay open, one marked current
document.querySelectorAll(".carousel").forEach(c => {
	let timer = null;
	let pause = () => {
		clearInterval(timer);
		timer = null;
	};
	let resume = () => {
		if (
			timer === null &&
			!c.matches(':hover') &&
			c.querySelector(':focus') === null
		) {
			timer = setInterval(() => rotate(c), 4000);
		}
	};
	c.querySelector('details[open] summary').classList.add("current");
	c.querySelectorAll('details').forEach(d => {
		d.open = true;
		d.querySelector('summary').addEventListener('click', function(evt) {
			evt.preventDefault();
			if (this.classList.contains("current")) {
				// activate the link
				this.parentElement.querySelector('a').click();
			} else {
				// mark this as current
				this.closest(".carousel").querySelectorAll('summary')
					.forEach(s => s.classList.remove("current"));
				this.classList.add("current");
			}
		});
	});
	c.addEventListener('mouseenter', pause);
	c.addEventListener('focusin', pause);
	c.addEventListener('mouseleave', resume);
	c.addEventListener('focusout', resume);
	resume();
});

// rotate current carousel item
function rotate(carousel) {
	let current = carousel.querySelector("summary.current");
	let currentDetail = current.parentElement;
	current.classList.remove("current");
	if (currentDetail.nextElementSibling) {
		currentDetail.nextElementSibling.querySelector('summary').classList.add("current");
	} else {
		carousel.firstElementChild.querySelector('summary').classList.add("current");
	}
}

})();
