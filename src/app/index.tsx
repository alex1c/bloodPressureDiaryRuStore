import { Redirect, type Href } from 'expo-router'

/** Legacy root — redirect into the diary tab group. */
export default function LegacyRootRedirect() {
	return <Redirect href={'/(tabs)' as Href} />
}
