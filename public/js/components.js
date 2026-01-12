// WalletWise Web Components
// Based on DESIGN_GUIDELINES.md

// Inject common styles for custom elements
const style = document.createElement("style");
style.textContent = `
    ww-button { display: inline-block; }
    ww-input, ww-select, ww-card { display: block; }
`;
document.head.appendChild(style);

class WwButton extends HTMLElement {
	static get observedAttributes() {
		return ["disabled", "type", "variant", "class"];
	}

	constructor() {
		super();
	}

	connectedCallback() {
		if (!this.querySelector("button")) {
			this.render();
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue || !this.querySelector("button")) return;

		const btn = this.querySelector("button");
		if (name === "disabled") {
			btn.disabled = this.hasAttribute("disabled");
		}
		if (name === "variant" || name === "class") {
			this.updateClasses(btn);
		}
		if (name === "type") {
			btn.type = newValue;
		}
	}

	get disabled() {
		return this.hasAttribute("disabled");
	}

	set disabled(val) {
		if (val) this.setAttribute("disabled", "");
		else this.removeAttribute("disabled");
	}

	updateClasses(btn) {
		const variant = this.getAttribute("variant") || "primary";
		// Base classes from instructions
		// Primary: bg-primary ...
		// Using strict colors from DESIGN_GUIDELINES.md mapped to tailwind classes
		// Primary: text-primary / bg-primary -> indigo-600
		// Primary Dark: bg-primary-dark -> indigo-700

		const variants = {
			primary:
				"bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm focus:ring-indigo-600",
			secondary:
				"bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 font-bold focus:ring-neutral-200",
			danger:
				"bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm focus:ring-red-600",
			"danger-ghost": "bg-red-50 text-red-600 hover:bg-red-100 font-bold",
			success:
				"bg-green-600 hover:bg-green-700 text-white font-bold shadow-sm focus:ring-green-600",
			ghost:
				"text-neutral-600 hover:text-neutral-900 bg-transparent hover:bg-neutral-100",
			dashed:
				"border-2 border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-400 font-bold",
			icon: "p-2 text-neutral-600 hover:bg-neutral-100 rounded-full", // Icon buttons are different
			menu: "block px-6 py-3 text-neutral-800 hover:bg-indigo-50 text-left w-full", // For menu links if needed
			danger_text: "text-red-600 hover:bg-red-50 font-bold",
		};

		const base =
			"rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center justify-center gap-2";
		const padding = variant === "icon" ? "" : "px-4 py-1.5";

		// Merge with incoming class attribute
		const extraClass = this.getAttribute("extra-class") || ""; // Custom attribute to add classes to button

		btn.className = `${base} ${padding} ${
			variants[variant] || variants.primary
		} ${extraClass}`;
	}

	render() {
		const type = this.getAttribute("type") || "button";
		const btn = document.createElement("button");
		btn.type = type;
		btn.disabled = this.hasAttribute("disabled");

		// Preserve children (text, icons)
		while (this.firstChild) {
			btn.appendChild(this.firstChild);
		}

		this.updateClasses(btn);

		// Pass click? No, native bubbling works.
		// But preventing default on wrapping element?

		this.appendChild(btn);
	}
}

class WwInput extends HTMLElement {
	static get observedAttributes() {
		return [
			"value",
			"disabled",
			"placeholder",
			"type",
			"required",
			"inputmode",
		];
	}

	connectedCallback() {
		if (!this.querySelector("input")) {
			this.render();
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue || !this.querySelector("input")) return;
		const input = this.querySelector("input");
		if (name === "value") input.value = newValue;
		if (name === "disabled") input.disabled = this.hasAttribute("disabled");
		if (name === "placeholder") input.placeholder = newValue;
		if (name === "required") input.required = this.hasAttribute("required");
		if (name === "inputmode") input.inputMode = newValue;
	}

	// ... getters/setters ...
	get value() {
		return this.querySelector("input")?.value || "";
	}
	set value(val) {
		const input = this.querySelector("input");
		if (input) input.value = val;
		this.setAttribute("value", val);
	}

	get disabled() {
		return this.hasAttribute("disabled");
	}
	set disabled(val) {
		if (val) this.setAttribute("disabled", "");
		else this.removeAttribute("disabled");
	}

	get required() {
		return this.hasAttribute("required");
	}
	set required(val) {
		if (val) this.setAttribute("required", "");
		else this.removeAttribute("required");
	}

	render() {
		const id = this.getAttribute("id");
		const name = this.getAttribute("name");
		const type = this.getAttribute("type") || "text";
		const label = this.getAttribute("label");
		const placeholder = this.getAttribute("placeholder") || "";
		const value = this.getAttribute("value") || "";
		const min = this.getAttribute("min");
		const max = this.getAttribute("max");
		const step = this.getAttribute("step");
		const required = this.hasAttribute("required");
		const inputmode = this.getAttribute("inputmode");

		const labelHtml = label
			? `<label class="block text-sm font-medium text-neutral-700 mb-1">${label}</label>`
			: "";

		this.innerHTML = `
            ${labelHtml}
            <input 
                type="${type}" 
                name="${name || ""}"
                class="h-9 w-full border border-neutral-300 rounded-lg px-2 text-sm text-neutral-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white placeholder-neutral-400"
                placeholder="${placeholder}"
                value="${value}"
                ${min ? `min="${min}"` : ""}
                ${max ? `max="${max}"` : ""}
                ${step ? `step="${step}"` : ""}
                ${required ? "required" : ""}
                ${inputmode ? `inputmode="${inputmode}"` : ""}
            >
        `;
		// ... listeners ...

		const input = this.querySelector("input");
		// Proxy events
		input.addEventListener("input", (e) => {
			e.stopPropagation();
			this.dispatchEvent(new Event("input", { bubbles: true }));
		});
		input.addEventListener("change", (e) => {
			e.stopPropagation();
			this.dispatchEvent(new Event("change", { bubbles: true }));
		});
		input.addEventListener("focus", () =>
			this.dispatchEvent(new Event("focus"))
		);
		input.addEventListener("blur", () => this.dispatchEvent(new Event("blur")));
	}
}

class WwSelect extends HTMLElement {
	static get observedAttributes() {
		return ["value", "disabled"];
	}

	connectedCallback() {
		if (!this.querySelector("select")) {
			this.render();
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (!this.querySelector("select")) return;
		const select = this.querySelector("select");
		if (name === "value") select.value = newValue;
		if (name === "disabled") select.disabled = this.hasAttribute("disabled");
	}

	get value() {
		return this.querySelector("select")?.value || "";
	}
	set value(val) {
		const select = this.querySelector("select");
		if (select) select.value = val;
		this.setAttribute("value", val);
	}

	get disabled() {
		return this.hasAttribute("disabled");
	}
	set disabled(val) {
		if (val) this.setAttribute("disabled", "");
		else this.removeAttribute("disabled");
	}

	get options() {
		return this.querySelector("select")?.options;
	}

	// Special method for Utils to populate
	setOptionsHtml(html) {
		const select = this.querySelector("select");
		if (select) select.innerHTML = html;
	}

	render() {
		const name = this.getAttribute("name");
		const label = this.getAttribute("label");

		// Move existing options code
		const children = this.innerHTML;

		const labelHtml = label
			? `<label class="block text-sm font-medium text-neutral-700 mb-1">${label}</label>`
			: "";

		this.innerHTML = `
            ${labelHtml}
            <select 
                name="${name || ""}"
                class="h-9 w-full border border-neutral-300 rounded-lg px-2 text-sm text-neutral-900 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white"
            >
                ${children}
            </select>
        `;

		const select = this.querySelector("select");
		select.addEventListener("change", (e) => {
			e.stopPropagation();
			this.dispatchEvent(new Event("change", { bubbles: true }));
		});
	}
}

class WwCard extends HTMLElement {
	connectedCallback() {
		this.className = `block bg-white rounded-lg shadow-sm p-4 ${
			this.getAttribute("class") || ""
		}`;
	}
}

customElements.define("ww-button", WwButton);
customElements.define("ww-input", WwInput);
customElements.define("ww-select", WwSelect);
customElements.define("ww-card", WwCard);
