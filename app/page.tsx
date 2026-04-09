"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

interface Card {
  id: number;
  card_name?: string | null;
  price?: number | null;
  image_url?: string | null;
  quantity?: number | null;
}

type SortOption =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc";

export default function Home() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");

  useEffect(() => {
    const fetchCards = async () => {
      const { data, error } = await supabase.from("cards").select("*");

      if (error) {
        console.error("Supabase fetch error:", error);
      } else {
        setCards(data || []);
      }

      setLoading(false);
    };

    fetchCards();
  }, []);

  const filteredAndSortedCards = useMemo(() => {
    const filtered = cards.filter((card) => {
      const name = (card.card_name ?? "").toLowerCase();
      return name.includes(search.toLowerCase());
    });

    const sorted = [...filtered];

    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) =>
          (a.card_name ?? "").localeCompare(b.card_name ?? "")
        );
        break;
      case "name-desc":
        sorted.sort((a, b) =>
          (b.card_name ?? "").localeCompare(a.card_name ?? "")
        );
        break;
      case "price-asc":
        sorted.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
        break;
      case "price-desc":
        sorted.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
        break;
    }

    // Move sold out to bottom
    sorted.sort((a, b) => {
      const aSoldOut = Number(a.quantity ?? 0) <= 0;
      const bSoldOut = Number(b.quantity ?? 0) <= 0;

      if (aSoldOut === bSoldOut) return 0;
      return aSoldOut ? 1 : -1;
    });

    return sorted;
  }, [cards, search, sortBy]);

  const handleBuy = async (
    cardId: number,
    price: number,
    cardName: string,
    quantity: number
  ) => {
    if (quantity <= 0) return;

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId,
          price,
          cardName,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Checkout route failed:", text);
        return;
      }

      const session = await response.json();

      if (session.url) {
        window.location.href = session.url;
      } else {
        console.error("No checkout URL returned:", session);
      }
    } catch (error) {
      console.error("Checkout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
      {/* HEADER */}
      <header className="flex flex-col items-center py-10 px-4">
        <h1
          className={`${inter.className} text-5xl md:text-6xl font-extrabold tracking-tight text-center`}
        >
          <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,215,0,0.25)]">
            RMT
          </span>
          <span className="text-white">rading Cards</span>
        </h1>
      </header>

      {/* SEARCH + SORT */}
      <section className="max-w-[1800px] mx-auto px-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:max-w-md rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          >
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="price-asc">Price Low → High</option>
            <option value="price-desc">Price High → Low</option>
          </select>
        </div>
      </section>

      {/* CARDS */}
      <main className="max-w-[1800px] mx-auto px-6 pb-10">
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="bg-zinc-800/95 border border-zinc-700 rounded-2xl shadow-xl overflow-hidden p-4 animate-pulse"
              >
                <div className="w-full aspect-[5/7] mb-4 rounded-xl bg-zinc-700/60" />
                <div className="h-6 w-3/4 mx-auto rounded bg-zinc-700/60 mb-3" />
                <div className="h-6 w-1/3 mx-auto rounded bg-zinc-700/60 mb-2" />
                <div className="h-4 w-1/4 mx-auto rounded bg-zinc-700/50 mb-4" />
                <div className="h-10 w-full rounded-lg bg-zinc-700/60" />
              </div>
            ))}
          </div>
        ) : filteredAndSortedCards.length === 0 ? (
          <p className="text-center text-lg text-zinc-400">
            No cards found.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
            {filteredAndSortedCards.map((card, index) => {
              const quantity = Number(card.quantity ?? 0);
              const soldOut = quantity <= 0;

              return (
                <div
                  key={card.id}
                  className="bg-zinc-800/95 border border-zinc-700 rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-4 transition duration-300 hover:-translate-y-1 hover:border-zinc-500 hover:shadow-2xl"
                >
                  <div className="relative w-full aspect-[5/7] mb-4 rounded-xl overflow-hidden bg-zinc-900">
                    {card.image_url ? (
                      <>
                        <Image
                          src={card.image_url}
                          alt={card.card_name ?? "Card image"}
                          fill
                          sizes="(max-width: 640px) 100vw,
                                 (max-width: 1024px) 50vw,
                                 (max-width: 1536px) 33vw,
                                 240px"
                          loading={index < 200 ? "eager" : "lazy"}
                          priority={index < 200}
                          className="object-contain"
                        />

                        {soldOut && (
                          <div className="absolute inset-0 bg-black/65 flex items-center justify-center z-10">
                            <span className="text-white text-xl font-bold tracking-[0.2em] uppercase bg-red-600/90 px-5 py-2 rounded-lg shadow-lg">
                              Sold Out
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                        No Image
                      </div>
                    )}
                  </div>

                  <h2 className="text-lg font-semibold text-center text-white min-h-[52px] flex items-center justify-center">
                    {card.card_name ?? "Unnamed Card"}
                  </h2>

                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    ${Number(card.price ?? 0).toFixed(2)}
                  </p>

                  <p className="text-sm text-zinc-400 mt-1">
                    {soldOut ? "Out of stock" : `In stock: ${quantity}`}
                  </p>

                  <button
                    onClick={() =>
                      handleBuy(
                        card.id,
                        Number(card.price ?? 0),
                        card.card_name ?? "Unnamed Card",
                        quantity
                      )
                    }
                    disabled={soldOut}
                    className={`mt-4 px-6 py-2 font-semibold rounded-lg transition w-full ${
                      soldOut
                        ? "bg-zinc-600 text-zinc-300 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {soldOut ? "Sold Out" : "Buy Now"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}