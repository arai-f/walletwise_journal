import { createContext, useContext } from "react";

const AppContext = createContext(null);

export const AppProvider = ({ children, value }) => {
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useApp must be used within an AppProvider");
	}
	return context;
};

export default AppContext;
