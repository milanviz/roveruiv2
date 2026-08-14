"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type Language = "en" | "ja"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<string, Record<Language, string>> = {
  // Dashboard greetings
  "greeting.hey": {
    en: "Hey,",
    ja: "こんにちは、",
  },
  "greeting.question": {
    en: "What would you like to start with today?",
    ja: "今日は何から始めますか？",
  },

  // Sections
  "section.recentProjects": {
    en: "RECENT PROJECTS",
    ja: "最近のプロジェクト",
  },
  "section.topRoverAgents": {
    en: "TOP ROVER AGENTS",
    ja: "トップローバーエージェント",
  },
  "section.viewAll": {
    en: "VIEW ALL",
    ja: "すべて表示",
  },
  "section.agentsSubtitle": {
    en: "Designed for Marketing, Strategy & Planning Teams",
    ja: "マーケティング、戦略、企画チーム向けに設計",
  },

  // Project titles and descriptions
  "project.claimsAdjuster": {
    en: "Claims Adjuster Automation",
    ja: "保険請求自動化",
  },
  "project.marketHealth": {
    en: "Market Health Analysis",
    ja: "市場健全性分析",
  },
  "project.growthOpportunity": {
    en: "Growth Opportunity Report Q3",
    ja: "成長機会レポート Q3",
  },
  "project.productInnovation": {
    en: "Product Innovation Strategy",
    ja: "製品革新戦略",
  },
  "project.customerRetention": {
    en: "Customer Retention Analysis",
    ja: "顧客維持分析",
  },
  "project.description.claims": {
    en: "Automating Claim Assessment Workflows Using Rover's AI Insurance Module.",
    ja: "RoverのAI保険モジュールを使用した請求評価ワークフローの自動化。",
  },
  "project.description.innovation": {
    en: "Analyzing market trends and consumer behavior for new product development.",
    ja: "新製品開発のための市場動向と消費者行動の分析。",
  },
  "project.description.retention": {
    en: "Identifying key factors affecting customer loyalty and retention rates.",
    ja: "顧客ロイヤルティと維持率に影響する主要要因の特定。",
  },

  // Categories
  "category.aiDevelopment": {
    en: "AI Development",
    ja: "AI開発",
  },
  "category.strategy": {
    en: "Strategy",
    ja: "戦略",
  },
  "category.innovation": {
    en: "Innovation",
    ja: "革新",
  },
  "category.analytics": {
    en: "Analytics",
    ja: "分析",
  },

  // Agents
  "agent.filmIntelligence": {
    en: "Film Intelligence Specialist",
    ja: "フィルムインテリジェンススペシャリスト",
  },
  "agent.specialist": {
    en: "Specialist",
    ja: "スペシャリスト",
  },

  // Topbar
  "topbar.newProject": {
    en: "New Project",
    ja: "新規プロジェクト",
  },
  "topbar.upgradePlan": {
    en: "Upgrade your plan",
    ja: "プランをアップグレード",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  const t = (key: string): string => {
    return translations[key]?.[language] || key
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
