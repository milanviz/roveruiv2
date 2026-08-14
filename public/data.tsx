// app/projects/_data/projects.ts
export type Project = {
  id: string;
  title: string;
  category: string;
  date: string;
  description: string;
  tag: string; // e.g. "AI Development", "Strategy"
};

export const demoProjects: Project[] = [
  {
    id: "3269b047-abf8-4d58-82e4-84e1e0234d5a",
    title: "Global Laboratory Nonhuman Primates (NHPs) Market Research Report 2025",
    category: "My Reports",
    date: "2025",
    description:
      "Automating claim assessment workflows using Rover's AI Insurance Module.",
    tag: "AI Development",
  },
  {
    id: "e22a7a2f-6f0f-4e80-bb7e-21f2b9de1111",
    title:
      "Global Fischer–Tropsch (FT) Waxes Market Report, History And Forecast 2020–2031",
    category: "My Reports",
    date: "2020–2031",
    description: "The FT waxes market is growing as demand for high-purity waxes increases.",
    tag: "AI Development",
  },
  // …add more demo rows to match the screenshot feel
];
