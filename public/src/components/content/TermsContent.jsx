export default function TermsContent({ version }) {
	return (
		<div>
			<div className="px-5 py-2 bg-neutral-50 border-b border-neutral-100 flex justify-end">
				<span className="text-xs font-mono text-neutral-400">
					Version {version}
				</span>
			</div>

			<div className="divide-y divide-neutral-100">
				{/* はじめに */}
				<div className="p-5">
					<h3 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
						<i className="fas fa-file-signature text-indigo-600 w-5 text-center"></i>
						はじめに
					</h3>
					<div className="text-sm text-neutral-600 leading-relaxed pl-7">
						<p>
							本利用規約（以下、「本規約」といいます。）は、WalletWise
							Journal（以下、「本サービス」といいます。）の利用条件を定めるものです。本サービスを利用するユーザー（以下、「ユーザー」といいます。）は、本規約に同意の上、本サービスを利用するものとします。
						</p>
					</div>
				</div>

				{/* 第1条 */}
				<div className="p-5">
					<h3 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
						<i className="fas fa-robot text-purple-600 w-5 text-center"></i>
						第1条（AI機能の利用について）
					</h3>
					<div className="pl-7 text-sm text-neutral-600 leading-relaxed space-y-4">
						<p>
							本サービスの一部機能（AIスキャン解析、AIアドバイザーなど）では、Google社の提供するGemini
							APIを利用しています。
						</p>
						<div className="space-y-3">
							<div>
								<h4 className="font-bold text-neutral-800 text-xs mb-1">
									・データ送信
								</h4>
								<p>
									ユーザーが入力したデータ（レシート画像、取引履歴など）は、分析のためにGemini
									APIに送信されることがあります。
								</p>
							</div>
							<div>
								<h4 className="font-bold text-neutral-800 text-xs mb-1">
									・利用目的
								</h4>
								<p>
									送信されたデータは、本サービスの機能（データ解析、カテゴリ分類、アドバイス生成など）の提供および向上の目的でのみ利用され、Google社の
									<a
										href="https://policies.google.com/privacy"
										target="_blank"
										rel="noopener noreferrer"
										className="text-indigo-600 hover:underline"
									>
										プライバシーポリシー
									</a>
									に基づいて取り扱われます。
								</p>
							</div>
							<div>
								<h4 className="font-bold text-neutral-800 text-xs mb-1">
									・免責
								</h4>
								<p>
									AIによる分析結果やアドバイスは、その正確性や完全性を保証するものではなく、最終的な判断はユーザー自身の責任で行うものとします。
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* 第2条 */}
				<div className="p-5">
					<h3 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
						<i className="fas fa-database text-blue-500 w-5 text-center"></i>
						第2条（データへのアクセスについて）
					</h3>
					<div className="pl-7 text-sm text-neutral-600 leading-relaxed space-y-4">
						<p>
							本サービスは、データの保存および管理のためにFirebaseを使用しています。
						</p>
						<div className="space-y-3">
							<div>
								<h4 className="font-bold text-neutral-800 text-xs mb-1">
									・データ保管
								</h4>
								<p>
									ユーザーが登録したデータはFirebase上のデータベースに保存されます。
								</p>
							</div>
							<div>
								<h4 className="font-bold text-neutral-800 text-xs mb-1">
									・アクセス権
								</h4>
								<p>
									サービスの安定運用、障害対応、改善を目的として、開発・運用担当者がユーザーデータにアクセスする場合があります。
								</p>
							</div>
							<div>
								<h4 className="font-bold text-neutral-800 text-xs mb-1">
									・アクセス範囲
								</h4>
								<p>
									データへのアクセスは、上記の目的を達成するために必要な最小限の範囲に留め、個人情報の保護には最大限配慮します。
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* 第3条 */}
				<div className="p-5">
					<h3 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
						<i className="fas fa-shield-alt text-red-500 w-5 text-center"></i>
						第3条（免責事項）
					</h3>
					<div className="pl-7 text-sm text-neutral-600 leading-relaxed">
						<p>
							本サービスの利用により生じたいかなる損害についても、当方は一切の責任を負わないものとします。投資や財務に関する最終的な決定は、専門家のアドバイスを求めるなど、ユーザー自身の判断と責任において行ってください。
						</p>
					</div>
				</div>

				{/* 第4条 */}
				<div className="p-5">
					<h3 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
						<i className="fas fa-sync-alt text-green-600 w-5 text-center"></i>
						第4条（規約の変更）
					</h3>
					<div className="pl-7 text-sm text-neutral-600 leading-relaxed">
						<p>
							当方は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。変更後の規約は、本サービス上での掲示をもって効力を生じるものとします。
						</p>
					</div>
				</div>

				{/* 第5条：ライセンスとオープンソース */}
				<div className="p-5">
					<h3 className="flex items-center gap-2 font-bold text-neutral-900 mb-3">
						<i className="fas fa-code-branch text-orange-500 w-5 text-center"></i>
						第5条（ライセンスとオープンソース）
					</h3>
					<div className="pl-7 text-sm text-neutral-600 leading-relaxed">
						<p className="mb-2">
							本アプリケーションは、オープンソースソフトウェアとして公開されており、
							<a
								href="https://www.gnu.org/licenses/agpl-3.0.html"
								target="_blank"
								rel="noopener noreferrer"
								className="text-indigo-600 hover:underline mx-1"
							>
								GNU Affero General Public License v3.0 (AGPL v3)
							</a>
							の下で提供されています。
						</p>
						<p>
							本サービスのソースコードは
							<a
								href="https://github.com/arai-f/walletwise_journal"
								target="_blank"
								rel="noopener noreferrer"
								className="text-indigo-600 hover:underline mx-1"
							>
								GitHub
							</a>
							にて入手可能です。ライセンスの条件下において、複製、改変、および再配布を行うことができます。
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
