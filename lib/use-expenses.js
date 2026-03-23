"use client";
import { useState, useEffect, useCallback } from "react";

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 전체 조회
  const fetchExpenses = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.order) params.set("order", filters.order);

      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  // 수동 추가
  const addExpense = useCallback(async (expense) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    });
    if (!res.ok) throw new Error("Failed to add expense");
    const data = await res.json();
    setExpenses((prev) => [...data, ...prev]);
    return data;
  }, []);

  // 삭제
  const deleteExpense = useCallback(async (id) => {
    const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete expense");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // 수정
  const updateExpense = useCallback(async (id, updates) => {
    const res = await fetch("/api/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update expense");
    const data = await res.json();
    setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  }, []);

  // AI 파싱 (이미지/텍스트 → 서버에서 Claude 호출 → DB 저장)
  const parseWithAI = useCallback(async (content, sourceFile) => {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, source_file: sourceFile }),
    });
    if (!res.ok) throw new Error("AI parsing failed");
    const data = await res.json();
    if (data.saved && data.records) {
      setExpenses((prev) => [...data.records, ...prev]);
    }
    return data;
  }, []);

  // 파일 → base64 변환 후 AI 파싱
  const parseFile = useCallback(async (file) => {
    if (file.type.startsWith("image/")) {
      const base64 = await fileToBase64(file);
      return parseWithAI(
        [
          { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
          { type: "text", text: "Extract all expense items from this receipt/invoice." },
        ],
        file.name
      );
    } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const text = await file.text();
      return parseWithAI(
        [{ type: "text", text: `Extract expense items from this CSV card statement:\n\n${text}` }],
        file.name
      );
    } else {
      const text = await file.text();
      return parseWithAI(
        [{ type: "text", text: `Extract expense items from:\n\n${text}` }],
        file.name
      );
    }
  }, [parseWithAI]);

  // 텍스트 파싱 (이메일 붙여넣기 등)
  const parseText = useCallback(async (text) => {
    return parseWithAI(
      [{ type: "text", text: `Extract expense items from this email/text:\n\n${text}` }],
      "텍스트 입력"
    );
  }, [parseWithAI]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    addExpense,
    deleteExpense,
    updateExpense,
    parseFile,
    parseText,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}
