import { useCallback, useEffect, useState } from "react";

/**
 * useActiveSection の設定オプション。
 */
export interface UseActiveSectionOptions {
	/** 監視対象のセクション要素セレクタ。デフォルト: 'main > section[id]' */
	sectionSelector?: string;
	/** IntersectionObserver の rootMargin。デフォルト: '-100px 0px -70% 0px' */
	rootMargin?: string;
	/** 最上部または初期状態のアクティブセクションID。デフォルト: 'home-section' */
	defaultSection?: string;
	/** 再バインドのトリガーとなる依存値（例: データローディング状態の変化など）。 */
	dependency?: unknown;
}

/**
 * 画面上のセクション表示状態を監視し、現在アクティブなセクションIDと
 * 指定セクションへのスムーズスクロール移動関数を提供するカスタムフック。
 */
export function useActiveSection({
	sectionSelector = "main > section[id]",
	rootMargin = "-100px 0px -70% 0px",
	defaultSection = "home-section",
	dependency,
}: UseActiveSectionOptions = {}) {
	const [activeSection, setActiveSection] = useState(defaultSection);

	useEffect(() => {
		const sections = document.querySelectorAll<HTMLElement>(sectionSelector);
		if (sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visibleEntry = entries.find((entry) => entry.isIntersecting);
				if (visibleEntry) {
					setActiveSection((prev) =>
						prev === visibleEntry.target.id ? prev : visibleEntry.target.id,
					);
				}
			},
			{
				rootMargin,
				threshold: 0,
			},
		);

		sections.forEach((section) => observer.observe(section));

		// ページ先頭付近に戻った際に確実にホームセクションをアクティブにする
		const handleScroll = () => {
			if (window.scrollY < 50) {
				setActiveSection((prev) =>
					prev === defaultSection ? prev : defaultSection,
				);
			}
		};
		window.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", handleScroll);
		};
	}, [sectionSelector, rootMargin, defaultSection, dependency]);

	/**
	 * 指定されたセクションへスムーズスクロールする。
	 */
	const scrollToSection = useCallback(
		(sectionId: string) => {
			if (sectionId === defaultSection) {
				window.scrollTo({ top: 0, behavior: "smooth" });
				return;
			}
			const element = document.getElementById(sectionId);
			if (element) {
				element.scrollIntoView({ behavior: "smooth" });
			}
		},
		[defaultSection],
	);

	return {
		activeSection,
		setActiveSection,
		scrollToSection,
	};
}

