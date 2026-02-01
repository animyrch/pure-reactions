export const EXPORT_VERSION = '1.0';

const isTimestamp = (value) =>
	value && typeof value === 'object' && typeof value.toDate === 'function';

const isGeoPoint = (value) =>
	value && typeof value === 'object' && typeof value.latitude === 'number' && typeof value.longitude === 'number';

export const serializeFirestoreValue = (value) => {
	if (Array.isArray(value)) {
		return value.map(serializeFirestoreValue);
	}
	if (isTimestamp(value)) {
		return value.toDate().toISOString();
	}
	if (isGeoPoint(value)) {
		return {
			latitude: value.latitude,
			longitude: value.longitude
		};
	}
	if (value && typeof value === 'object') {
		const serialized = {};
		for (const [key, entry] of Object.entries(value)) {
			serialized[key] = serializeFirestoreValue(entry);
		}
		return serialized;
	}
	return value;
};

export const serializeFirestoreDoc = (docSnapshot) => ({
	id: docSnapshot.id,
	data: serializeFirestoreValue(docSnapshot.data())
});

export const sortById = (a, b) => a.id.localeCompare(b.id);

export const sortByObjectId = (a, b) => a.objectID.localeCompare(b.objectID);

export const chunkArray = (items, size) => {
	if (!Array.isArray(items) || size <= 0) return [];
	const chunks = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
};
