import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase.js";
import * as store from "../services/store.js";

/**
 * 認証、ユーザー設定、マスタデータ、口座残高を管理するフック。
 * Firebase Authの監視と、Firestoreからのユーザーデータ同期を行う。
 * @returns {object} 認証状態とデータ操作関数を含むオブジェクト。
 */
export function useAuthData() {
	const [user, setUser] = useState(null);
	const [luts, setLuts] = useState({
		accounts: new Map(),
		categories: new Map(),
	});
	const [config, setConfig] = useState({});
	const [accountBalances, setAccountBalances] = useState({});
	const [loading, setLoading] = useState(true);

	/**
	 * Firestoreからマスタデータ（口座、カテゴリ）と設定を読み込む。
	 * @async
	 */
	const loadLutsAndConfig = useCallback(async () => {
		if (!auth.currentUser) return;
		try {
			const {
				accounts,
				categories,
				config: userConfig,
			} = await store.fetchAllUserData();

			setLuts({
				categories,
				accounts,
			});
			setConfig(userConfig || {});
		} catch (error) {
			console.error("[useAuthData] Failed to load LUTs and Config:", error);
		}
	}, []);

	useEffect(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
			setUser(currentUser);
			if (currentUser) {
				setLoading(true);
				await loadLutsAndConfig();
				setLoading(false);
			} else {
				setLuts({ accounts: new Map(), categories: new Map() });
				setConfig({});
				setAccountBalances({});
				setLoading(false);
			}
		});
		return () => unsubscribeAuth();
	}, [loadLutsAndConfig]);

	useEffect(() => {
		if (!user) return;
		const unsubBalances = store.subscribeAccountBalances((newBalances) => {
			setAccountBalances(newBalances);
		});
		return () => {
			if (unsubBalances) unsubBalances();
		};
	}, [user]);

	/**
	 * Google認証を使用してログインする。
	 * @async
	 * @throws {Error} ログインに失敗した場合にエラーを投げる。
	 */
	const login = async () => {
		const provider = new GoogleAuthProvider();
		try {
			await signInWithPopup(auth, provider);
		} catch (error) {
			console.error("[useAuthData] Login failed:", error);
			throw error;
		}
	};

	/**
	 * ログアウトする。
	 * @async
	 */
	const logout = async () => {
		await signOut(auth);
	};

	/**
	 * ユーザー設定を更新し、Firestoreに保存する。
	 * 保存後、ローカルの設定状態も再読み込みする。
	 * @async
	 * @param {object} newConfig - 更新する設定内容。
	 */
	const updateConfig = async (newConfig) => {
		await store.updateConfig(newConfig);
		await loadLutsAndConfig();
	};

	/**
	 * 設定とマスタデータを再読み込みする。
	 * @async
	 */
	const refreshSettings = async () => {
		await loadLutsAndConfig();
	};

	return {
		user,
		luts,
		config,
		accountBalances,
		loading,
		login,
		logout,
		updateConfig,
		refreshSettings,
	};
}
