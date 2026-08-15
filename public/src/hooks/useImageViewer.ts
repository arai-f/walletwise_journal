import * as React from "react";
import { useState } from "react";
import type { ImageViewerState } from "../types/hooks.js";

/**
 * 画像ビューアの操作ロジックを提供するカスタムフック。
 * ズーム、パン（ドラッグ）、リセット機能の状態管理を行う。
 * @returns {object} ビューアの状態と操作関数。
 */
export function useImageViewer() {
	const [viewState, setViewState] = useState<ImageViewerState>({
		scale: 1,
		x: 0,
		y: 0,
		dragging: false,
		startX: 0,
		startY: 0,
	});

	const handleWheel = (e: React.WheelEvent<HTMLElement>): void => {
		e.preventDefault();
		const scaleAdjustment = e.deltaY * -0.001;
		const newScale = Math.min(
			Math.max(0.5, viewState.scale + scaleAdjustment),
			5,
		);
		setViewState((prev) => ({ ...prev, scale: newScale }));
	};

	const handleMouseDown = (e: React.MouseEvent<HTMLElement>): void => {
		e.preventDefault();
		setViewState((prev) => ({
			...prev,
			dragging: true,
			startX: e.clientX - prev.x,
			startY: e.clientY - prev.y,
		}));
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLElement>): void => {
		if (!viewState.dragging) return;
		e.preventDefault();
		setViewState((prev) => ({
			...prev,
			x: e.clientX - prev.startX,
			y: e.clientY - prev.startY,
		}));
	};

	const handleMouseUp = (): void => {
		setViewState((prev) => ({ ...prev, dragging: false }));
	};

	const handleZoom = (factor: number): void => {
		setViewState((prev) => ({
			...prev,
			scale: Math.min(Math.max(0.5, prev.scale + factor), 5),
		}));
	};

	const handleResetView = (): void => {
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
