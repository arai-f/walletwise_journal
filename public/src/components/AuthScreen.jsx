import logoImg from "../../favicon/web-app-manifest-512x512.png";

const AuthScreen = ({ isLoading, isUpdating, onLogin }) => {
	return (
		<div className="text-center py-20 px-4 animate-fade-in">
			<div id="auth-container">
				{isLoading && !isUpdating && (
					<div id="loading-indicator">
						<i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
						<p className="mt-4 text-lg">認証情報を確認しています...</p>
					</div>
				)}

				{isUpdating && (
					<div id="update-indicator">
						<i className="fas fa-sync-alt fa-spin text-4xl text-primary"></i>
						<p className="mt-4 text-lg">アプリを更新しています...</p>
					</div>
				)}

				{!isLoading && !isUpdating && (
					<div id="login-container">
						<div className="mb-10">
							<img
								src={logoImg}
								alt="Logo"
								className="w-20 h-20 mx-auto rounded-2xl shadow-sm mb-4"
							/>
							<h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
								<span className="bg-clip-text text-transparent bg-linear-to-r from-primary to-violet-600">
									WalletWise
								</span>{" "}
								Journal
							</h1>
							<p className="text-neutral-500 text-sm mt-2">
								あなたの資産管理をもっと賢く、もっと簡単に。
							</p>
						</div>

						<h2 className="text-xl font-bold mb-4 hidden">おかえりなさい</h2>
						<button
							onClick={onLogin}
							className="bg-white text-neutral-800 font-semibold py-3 px-6 rounded-lg shadow-md border border-neutral-200 hover:bg-neutral-100 transition inline-flex items-center"
						>
							<img
								src="https://www.google.com/favicon.ico"
								alt="Google"
								className="w-6 h-6 mr-3"
							/>
							Googleアカウントでログイン
						</button>

						<p className="text-xs text-neutral-400 mt-8">
							This site is protected by reCAPTCHA and the Google{" "}
							<a
								href="https://policies.google.com/privacy"
								target="_blank"
								rel="noreferrer"
								className="underline hover:text-neutral-600"
							>
								Privacy Policy
							</a>{" "}
							and{" "}
							<a
								href="https://policies.google.com/terms"
								target="_blank"
								rel="noreferrer"
								className="underline hover:text-neutral-600"
							>
								Terms of Service
							</a>{" "}
							apply.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default AuthScreen;
