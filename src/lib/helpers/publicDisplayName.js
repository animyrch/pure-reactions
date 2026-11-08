const trimmedText = (value) => (typeof value === 'string' ? value.trim() : '');

const emailLocalPart = (email) => {
	const trimmed = trimmedText(email);
	const atIndex = trimmed.indexOf('@');
	if (atIndex <= 0) return '';
	return trimmed.slice(0, atIndex);
};

export const displayNameMatchesEmailLocalPart = (displayName, email) => {
	const name = trimmedText(displayName);
	const localPart = emailLocalPart(email);
	if (!name || !localPart) return false;
	return name.toLowerCase() === localPart.toLowerCase();
};
