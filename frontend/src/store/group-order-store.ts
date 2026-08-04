"use client";

import { create } from "zustand";
import { getSocket } from "@/lib/socket";
import type { MenuItem } from "@/lib/menu-data";

export interface GroupParticipant {
  participantId: string;
  name: string;
}

export interface GroupCartLine {
  lineId: string; // `${menuItemId}:${participantId}`
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  participantId: string;
  participantName: string;
}

const PARTICIPANT_ID_KEY = "smartqr-participant-id";
const PARTICIPANT_NAME_KEY = "smartqr-participant-name";

function loadParticipantId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(PARTICIPANT_ID_KEY);
  if (!id) {
    id = `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(PARTICIPANT_ID_KEY, id);
  }
  return id;
}

function loadParticipantName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PARTICIPANT_NAME_KEY) ?? "";
}

interface GroupOrderState {
  active: boolean;
  restaurantId: string | null;
  tableToken: string | null;
  participantId: string;
  participantName: string;
  participants: GroupParticipant[];
  lines: GroupCartLine[];
  _listenersBound: boolean;

  join: (restaurantId: string, tableToken: string, name?: string) => void;
  leave: () => void;
  addItem: (item: MenuItem) => void;
  removeItem: (item: MenuItem) => void;

  quantityFor: (menuItemId: string) => number;
  myQuantityFor: (menuItemId: string) => number;
  subtotalFor: (participantId: string) => number;
  totalItems: () => number;
  totalSubtotal: () => number;
}

export const useGroupOrderStore = create<GroupOrderState>()((set, get) => ({
  active: false,
  restaurantId: null,
  tableToken: null,
  participantId: loadParticipantId(),
  participantName: loadParticipantName(),
  participants: [],
  lines: [],
  _listenersBound: false,

  join: (restaurantId, tableToken, name) => {
    const socket = getSocket();
    const { participantId } = get();
    const resolvedName = (name ?? get().participantName ?? "").trim() || "Guest";

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PARTICIPANT_NAME_KEY, resolvedName);
    }

    if (!get()._listenersBound) {
      socket.on("group:state", (state: { participants: GroupParticipant[]; lines: GroupCartLine[] }) => {
        set({ participants: state.participants, lines: state.lines });
      });
      set({ _listenersBound: true });
    }

    set({
      active: true,
      restaurantId,
      tableToken,
      participantName: resolvedName,
    });

    socket.emit("group:join", {
      restaurantId,
      tableToken,
      participantId,
      name: resolvedName,
    });
  },

  leave: () => {
    const { restaurantId, tableToken, participantId, active } = get();
    if (active && restaurantId && tableToken) {
      getSocket().emit("group:leave", { restaurantId, tableToken, participantId });
    }
    set({ active: false, restaurantId: null, tableToken: null, participants: [], lines: [] });
  },

  addItem: (item) => {
    const { active, restaurantId, tableToken, participantId, participantName } = get();
    if (!active || !restaurantId || !tableToken) return;
    getSocket().emit("group:add-item", {
      restaurantId,
      tableToken,
      participantId,
      name: participantName || "Guest",
      item: { id: item.id, name: item.name, price: item.price },
    });
  },

  removeItem: (item) => {
    const { active, restaurantId, tableToken, participantId } = get();
    if (!active || !restaurantId || !tableToken) return;
    getSocket().emit("group:remove-item", {
      restaurantId,
      tableToken,
      participantId,
      itemId: item.id,
    });
  },

  quantityFor: (menuItemId) =>
    get()
      .lines.filter((l) => l.menuItemId === menuItemId)
      .reduce((sum, l) => sum + l.quantity, 0),

  myQuantityFor: (menuItemId) => {
    const { participantId, lines } = get();
    return lines
      .filter((l) => l.menuItemId === menuItemId && l.participantId === participantId)
      .reduce((sum, l) => sum + l.quantity, 0);
  },

  subtotalFor: (participantId) =>
    get()
      .lines.filter((l) => l.participantId === participantId)
      .reduce((sum, l) => sum + l.price * l.quantity, 0),

  totalItems: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
  totalSubtotal: () => get().lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
}));
