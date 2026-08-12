import { Suspense } from "react"
import SavedInsightsContent from "@/components/saved-insights"

export default function InsightsListPage() {
    return (
        <Suspense fallback={<div>Loading insights...</div>}>
            <SavedInsightsContent />
        </Suspense>
    )
}