import { vi } from 'vitest';

export const Map = vi.fn().mockImplementation(() => ({
	on: vi.fn(),
	off: vi.fn(),
	remove: vi.fn(),
	addControl: vi.fn(),
	getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
	getZoom: vi.fn(() => 11),
	setCenter: vi.fn(),
	setZoom: vi.fn(),
	flyTo: vi.fn(),
	_listeners: {}
}));

export const Marker = vi.fn().mockImplementation(() => ({
	setLngLat: vi.fn().mockReturnThis(),
	addTo: vi.fn().mockReturnThis(),
	remove: vi.fn()
}));

export const NavigationControl = vi.fn();
