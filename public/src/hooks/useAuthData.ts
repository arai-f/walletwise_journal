import {
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
	type User,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase.js";
import * as store from "../services/store.js";
import type {
	AccountBalances,
	Luts,
} from "../types/hooks.js";
import type { AppConfig } from "../types/settings.js";

/**
 * `useAuthData` が返す setter / 関数の緩いシグネチャ。
 * 既存の呼び出し側（`AppContext.tsx` の `AppActions` で
 * `(...args: unknown[]) => unknown` と受ける前提）との互換性を保つ。
 */
type LooseFn = (...args: unknown[]) => unknown;

/**
 * 認証、ユーザー設定、マスタデータ、口座残高を管理するフック。
 * Firebase Authの監視と、Firestoreからのユーザーデータ同期を行う。
 * @returns {object} 認証状態とデータ操作関数を含むオブジェクト。
 */
export function useAuthData() {
	const [user, setUser] = useState<User | null>(null);
	const [luts, setLuts] = useState<Luts>({
		accounts: new Map(),
		categories: new Map(),
	});
	const [config, setConfig] = useState<AppConfig>({});
	const [accountBalances, setAccountBalances] = useState<AccountBalances>({});
	const [loading, setLoading] = useState<boolean>(true);

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
	const login = async (): Promise<void> => {
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
	const logout = async (): Promise<void> => {
		await signOut(auth);
	};

	/**
	 * ユーザー設定を更新し、Firestoreに保存する。
	 * 保存後、ローカルの設定状態も再読み込みする。
	 * @async
	 * @param {object} newConfig - 更新する設定内容。
	 */
	const updateConfig = async (newConfig: Partial<AppConfig>): Promise<void> => {
		await store.updateConfig(newConfig as Record<string, unknown>);
		await loadLutsAndConfig();
	};

	/**
	 * 設定とマスタデータを再読み込みする。
	 * @async
	 */
	const refreshSettings = async (): Promise<void> => {
		await loadLutsAndConfig();
	};

	return {
		user,
		luts,
		config,
		accountBalances,
		loading,
		login: login as LooseFn,
		logout: logout as LooseFn,
		updateConfig: updateConfig as LooseFn,
		refreshSettings: refreshSettings as LooseFn,
	};
}
