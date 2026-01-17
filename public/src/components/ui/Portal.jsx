import { createPortal } from "react-dom";
import * as utils from "../../utils.js";

/**
 * React Portalへのレンダリングを行うラッパーコンポーネントである。
 * targetIdが指定されている場合はそのDOM要素へ、指定がない場合はbodyへレンダリングする。
 * @param {Object} props - プロパティ。
 * @param {React.ReactNode} props.children - レンダリングする子要素。
 * @param {string} [props.targetId] - ポータル先のDOM ID。
 * @returns {React.ReactPortal|null} ポータル、またはターゲットが見つからない場合はnull。
 */
const Portal = ({ children, targetId }) => {
	const target = targetId ? utils.dom.get(targetId) : document.body;
	return target ? createPortal(children, target) : null;
};

export default Portal;
