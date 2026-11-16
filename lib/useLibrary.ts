'use client'
import { useSyncExternalStore } from 'react'
import { getLibrary, subscribeLibrary, type LibraryItem } from './media'

const none: LibraryItem[] = []
export const useLibrary = (): LibraryItem[] => useSyncExternalStore(subscribeLibrary, getLibrary, () => none)
