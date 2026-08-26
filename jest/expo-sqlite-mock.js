module.exports = {
	openDatabaseAsync: async () => {
		throw new Error('expo-sqlite is not available in Jest Node tests')
	},
}
