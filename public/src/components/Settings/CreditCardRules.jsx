import { deleteField } from "firebase/firestore";
import { useEffect, useState } from "react";

/**
 * クレジットカードの支払いルール設定画面コンポーネント。
 * 締め日、支払日、支払元口座などの設定をカードごとに追加・編集・削除できる。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {object} props.store - ストア操作オブジェクト。
 * @param {Function} props.getState - ステート取得関数。
 * @param {Function} props.refreshApp - アプリ再ロード関数。
 * @return {JSX.Element} クレジットカードルール設定コンポーネント。
 */
export default function CreditCardRules({ store, getState, refreshApp }) {
	const [rules, setRules] = useState({});
	const [accounts, setAccounts] = useState([]);
	const [isEditing, setIsEditing] = useState(false);
	const [editingCardId, setEditingCardId] = useState(null);

	const [formData, setFormData] = useState({
		cardId: "",
		closingDay: 15,
		paymentMonthOffset: 1,
		paymentDay: 10,
		paymentAccountId: "",
	});

	useEffect(() => {
		loadData();
	}, [getState]);

	const loadData = () => {
		const state = getState();
		const config = state.config || {};
		setRules(config.creditCardRules || {});
		setAccounts([...state.luts.accounts.values()].filter((a) => !a.isDeleted));
	};

	/**
	 * 既存ルールの編集を開始する。
	 * @param {string} cardId - 編集対象のカードID
	 */
	const handleEdit = (cardId) => {
		const rule = rules[cardId];
		setFormData({
			cardId: cardId,
			closingDay: rule.closingDay,
			paymentMonthOffset: rule.paymentMonthOffset || 1,
			paymentDay: rule.paymentDay,
			paymentAccountId: rule.defaultPaymentAccountId,
		});
		setEditingCardId(cardId);
		setIsEditing(true);
	};

	/**
	 * 新規ルール追加モードを開始する。
	 */
	const handleAddNew = () => {
		setFormData({
			cardId: "",
			closingDay: 15,
			paymentMonthOffset: 1,
			paymentDay: 10,
			paymentAccountId: "",
		});
		setEditingCardId(null);
		setIsEditing(true);
	};

	/**
	 * フォームの内容を検証し、設定を保存する。
	 */
	const handleSave = async () => {
		const {
			cardId,
			closingDay,
			paymentDay,
			paymentMonthOffset,
			paymentAccountId,
		} = formData;

		if (!cardId) return alert("カードを選択してください");
		if (!paymentAccountId) return alert("支払元口座を選択してください");

		const cDay = parseInt(closingDay);
		const pDay = parseInt(paymentDay);

		if (isNaN(cDay) || cDay < 1 || cDay > 31)
			return alert("締め日を正しく入力してください");
		if (isNaN(pDay) || pDay < 1 || pDay > 31)
			return alert("支払日を正しく入力してください");

		const ruleData = {
			closingDay: cDay,
			paymentDay: pDay,
			paymentMonthOffset: parseInt(paymentMonthOffset),
			defaultPaymentAccountId: paymentAccountId,
		};

		try {
			await store.updateConfig(
				{ creditCardRules: { [cardId]: ruleData } },
				true
			);
			await refreshApp(true);
			loadData();
			setIsEditing(false);
		} catch (e) {
			console.error(e);
			alert("保存に失敗しました");
		}
	};

	/**
	 * ルールを削除する。
	 * @param {string} cardId - 削除対象のカードID
	 */
	const handleDelete = async (cardId) => {
		if (!confirm("このルールを削除しますか？")) return;
		try {
			const fieldPath = `creditCardRules.${cardId}`;
			await store.updateConfig({ [fieldPath]: deleteField() });
			await refreshApp(true);
			loadData();
		} catch (e) {
			console.error(e);
			alert("削除に失敗しました");
		}
	};

	const liabilityAccounts = accounts.filter((a) => a.type === "liability");
	const assetAccounts = accounts.filter((a) => a.type === "asset");

	// 追加時はまだ設定されていないカードのみを選択候補にする
	const availableCards = editingCardId
		? liabilityAccounts
		: liabilityAccounts.filter((a) => !rules[a.id]);

	const configuredCards = liabilityAccounts.filter((a) => rules[a.id]);

	return (
		<div className="p-4">
			<div className="flex justify-between items-center mb-4">
				<h3 className="font-bold text-neutral-800 border-l-4 border-primary pl-3">
					カード支払い設定
				</h3>
				<button
					onClick={handleAddNew}
					disabled={availableCards.length === 0 && !isEditing}
					className={`text-primary font-medium text-sm flex items-center gap-1 ${
						availableCards.length === 0 && !isEditing
							? "opacity-50 cursor-not-allowed"
							: "hover:text-primary-dark"
					}`}
				>
					<i className="fas fa-plus"></i> 追加
				</button>
			</div>

			{isEditing && (
				<div className="bg-primary-light p-4 rounded-md border border-primary-ring mb-4 text-sm animate-fade-in">
					<h4 className="font-bold text-neutral-900 mb-3">
						{editingCardId ? "ルールを編集" : "新しいルールを追加"}
					</h4>

					<div className="space-y-3">
						<div className="grid grid-cols-12 items-center gap-2">
							<label className="col-span-4 font-semibold text-neutral-800">
								対象カード
							</label>
							<div className="col-span-8">
								<select
									className="w-full border-neutral-300 rounded px-2 h-9 bg-white"
									value={formData.cardId}
									onChange={(e) =>
										setFormData({ ...formData, cardId: e.target.value })
									}
									disabled={!!editingCardId}
								>
									<option value="">選択してください</option>
									{(editingCardId
										? [accounts.find((a) => a.id === editingCardId)]
										: availableCards
									)
										.filter(Boolean)
										.map((a) => (
											<option key={a.id} value={a.id}>
												{a.name}
											</option>
										))}
								</select>
							</div>
						</div>

						<div className="grid grid-cols-12 items-center gap-2">
							<label className="col-span-4 font-semibold text-neutral-800">
								締め日/支払日
							</label>
							<div className="col-span-8 flex flex-col gap-2">
								<div className="flex items-center gap-2">
									<span className="text-xs">締め: 毎月</span>
									<input
										type="number"
										className="w-16 border-neutral-300 rounded px-2 h-8"
										value={formData.closingDay}
										onChange={(e) =>
											setFormData({ ...formData, closingDay: e.target.value })
										}
										min="1"
										max="31"
									/>
									<span className="text-xs">日</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-xs">支払:</span>
									<select
										className="border-neutral-300 rounded px-2 h-8 text-xs bg-white"
										value={formData.paymentMonthOffset}
										onChange={(e) =>
											setFormData({
												...formData,
												paymentMonthOffset: e.target.value,
											})
										}
									>
										<option value="1">翌月</option>
										<option value="2">翌々月</option>
										<option value="3">3ヶ月後</option>
									</select>
									<input
										type="number"
										className="w-16 border-neutral-300 rounded px-2 h-8"
										value={formData.paymentDay}
										onChange={(e) =>
											setFormData({ ...formData, paymentDay: e.target.value })
										}
										min="1"
										max="31"
									/>
									<span className="text-xs">日</span>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-12 items-center gap-2">
							<label className="col-span-4 font-semibold text-neutral-800">
								支払元口座
							</label>
							<div className="col-span-8">
								<select
									className="w-full border-neutral-300 rounded px-2 h-9 bg-white"
									value={formData.paymentAccountId}
									onChange={(e) =>
										setFormData({
											...formData,
											paymentAccountId: e.target.value,
										})
									}
								>
									<option value="">選択してください</option>
									{assetAccounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-2 mt-4 pt-2 border-t border-primary-ring/30">
						<button
							onClick={() => setIsEditing(false)}
							className="px-3 py-1.5 text-xs text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 shadow-sm"
						>
							キャンセル
						</button>
						<button
							onClick={handleSave}
							className="px-3 py-1.5 text-xs text-white bg-primary rounded hover:bg-primary-dark shadow-sm"
						>
							保存
						</button>
					</div>
				</div>
			)}

			{/* ルール一覧 */}
			<div className="space-y-2">
				{configuredCards.map((card) => {
					const rule = rules[card.id];
					const paymentAccount = accounts.find(
						(a) => a.id === rule.defaultPaymentAccountId
					);
					const monthMap = { 1: "翌月", 2: "翌々月", 3: "3ヶ月後" };

					return (
						<div
							key={card.id}
							className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-200"
						>
							<div>
								<div className="flex items-center gap-2 mb-1">
									<i
										className={`${
											card.icon || "fa-solid fa-credit-card"
										} text-neutral-600`}
									></i>
									<span className="font-bold text-neutral-800">
										{card.name}
									</span>
								</div>
								<div className="text-xs text-neutral-600 flex flex-wrap gap-2 items-center">
									<span className="bg-white px-1.5 py-0.5 rounded border border-neutral-300">
										{rule.closingDay}日締め
									</span>
									<i className="fas fa-arrow-right text-neutral-400"></i>
									<span className="bg-white px-1.5 py-0.5 rounded border border-neutral-300">
										{monthMap[rule.paymentMonthOffset] || "翌月"}{" "}
										{rule.paymentDay}日払い
									</span>
									<span className="text-neutral-500">
										({paymentAccount?.name || "???"})
									</span>
								</div>
							</div>
							<div className="flex items-center gap-1">
								<button
									onClick={() => handleEdit(card.id)}
									className="p-2 text-primary hover:bg-white rounded hover:shadow-sm"
								>
									<i className="fas fa-pen"></i>
								</button>
								<button
									onClick={() => handleDelete(card.id)}
									className="p-2 text-danger hover:bg-white rounded hover:shadow-sm"
								>
									<i className="fas fa-trash-alt"></i>
								</button>
							</div>
						</div>
					);
				})}
				{configuredCards.length === 0 && !isEditing && (
					<p className="text-center text-neutral-500 text-sm py-8">
						設定済みのカードはありません
					</p>
				)}
			</div>
		</div>
	);
}
