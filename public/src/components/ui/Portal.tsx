import { useEffect, useState, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Portalコンポーネントのプロパティ。
 */
interface PortalProps {
	/** レンダリングする子要素。 */
	children: ReactNode;
	/**
	 * ポータル先のDOM要素のID。
	 * 指定がない場合は `document.body` にレンダリングされる。
	 */
	targetId?: string;
}

/**
 * React Portalへのレンダリングを行うラッパーコンポーネント。
 * クライアントサイドでのみマウント先のDOMを解決するため、SSR環境でも安全に利用できる。
 * @param props - コンポーネントプロパティ。
 * @returns ポータル、またはターゲットが見つからない場合はnull。
 */
const Portal: FC<PortalProps> = ({ children, targetId }) => {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		return () => setMounted(false);
	}, []);

	if (!mounted) {
		return null;
	}

	const target = targetId ? document.getElementById(targetId) : document.body;
	return target ? createPortal(children, target) : null;
};

export default Portal;