import { useState } from "react";

/**
 * 画像ビューアの操作ロジックを提供するカスタムフック。
 * ズーム、パン（ドラッグ）、リセット機能の状態管理を行う。
 * @returns {object} ビューアの状態と操作関数。
 */
export function useImageViewer() {
	const [viewState, setViewState] = useState({
		scale: 1,
		x: 0,
		y: 0,
		dragging: false,
		startX: 0,
		startY: 0,
	});

	const handleWheel = (e) => {
		e.preventDefault();
		const scaleAdjustment = e.deltaY * -0.001;
		const newScale = Math.min(
			Math.max(0.5, viewState.scale + scaleAdjustment),
			5,
		);
		setViewState((prev) => ({ ...prev, scale: newScale }));
	};

	const handleMouseDown = (e) => {
		e.preventDefault();
		setViewState((prev) => ({
			...prev,
			dragging: true,
			startX: e.clientX - prev.x,
			startY: e.clientY - prev.y,
		}));
	};

	const handleMouseMove = (e) => {
		if (!viewState.dragging) return;
		e.preventDefault();
		setViewState((prev) => ({
			...prev,
			x: e.clientX - prev.startX,
			y: e.clientY - prev.startY,
		}));
	};

	const handleMouseUp = () => {
		setViewState((prev) => ({ ...prev, dragging: false }));
	};

	const handleZoom = (factor) => {
		setViewState((prev) => ({
			...prev,
			scale: Math.min(Math.max(0.5, prev.scale + factor), 5),
		}));
	};

	const handleResetView = () => {
		setViewState({
			scale: 1,
			x: 0,
			y: 0,
			dragging: false,
			startX: 0,
			startY: 0,
		});
	};

	return {
		viewState,
		handleWheel,
		handleMouseDown,
		handleMouseMove,
		handleMouseUp,
		handleZoom,
		handleResetView,
	};
}
