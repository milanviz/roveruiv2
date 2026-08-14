// Client-side mock fetch interceptor
"use client";

if (typeof window !== "undefined") {
  // Save original fetch
  const originalFetch = window.fetch;

  // Initialize mock database in localStorage if not already present
  const initMockDatabase = () => {
    // 1. Projects
    if (!localStorage.getItem("rover_projects")) {
      const defaultProjects = [
        {
          ProjectID: "quantum-computing",
          ProjectName: "Quantum Computing Research",
          Summary: "Exploring quantum algorithms and error correction.",
          AIAgent: "Research Specialist",
          CreatedBy: "guest@hirover.ai",
          CreatedOn: "2026-08-01",
          rowid: "row-quantum"
        },
        {
          ProjectID: "generative-ai",
          ProjectName: "Generative AI in Enterprise",
          Summary: "Adoption strategies and security policies.",
          AIAgent: "Enterprise Specialist",
          CreatedBy: "guest@hirover.ai",
          CreatedOn: "2026-08-03",
          rowid: "row-genai"
        }
      ];
      localStorage.setItem("rover_projects", JSON.stringify(defaultProjects));
    }

    // 2. Chat history defaults
    const quantumHistoryKey = "rover_chat_history_quantum-computing";
    if (!localStorage.getItem(quantumHistoryKey)) {
      const defaultQuantumHistory = [
        {
          Question: "What is Shor's algorithm?",
          Answer: "Shor's algorithm is a quantum computer algorithm for finding the prime factors of an integer. It runs in polynomial time, meaning it is exponentially faster than the best-known classical algorithms, which could potentially break RSA cryptography.",
          QID: "q-quantum-1",
          UpvotedJSON: "[]",
          UpVotedCount: 0
        },
        {
          Question: "Explain quantum supremacy.",
          Answer: "Quantum supremacy refers to the demonstration that a programmable quantum device can solve a problem that is practically impossible for classical computers to solve in a reasonable timeframe.",
          QID: "q-quantum-2",
          UpvotedJSON: "[]",
          UpVotedCount: 0
        }
      ];
      localStorage.setItem(quantumHistoryKey, JSON.stringify(defaultQuantumHistory));
    }

    const genaiHistoryKey = "rover_chat_history_generative-ai";
    if (!localStorage.getItem(genaiHistoryKey)) {
      const defaultGenaiHistory = [
        {
          Question: "What are key risks of GenAI in enterprise?",
          Answer: "Key risks include data leakage (sensitive IP entered into public models), hallucinations (inaccurate or fabricated output), copyright/IP infringement, and compliance violations with data privacy regulations (like GDPR).",
          QID: "q-genai-1",
          UpvotedJSON: "[]",
          UpVotedCount: 0
        }
      ];
      localStorage.setItem(genaiHistoryKey, JSON.stringify(defaultGenaiHistory));
    }

    // 3. Insights defaults
    const quantumInsightsKey = "rover_insights_quantum-computing";
    if (!localStorage.getItem(quantumInsightsKey)) {
      const defaultQuantumInsights = [
        {
          ProjectID: "quantum-computing",
          Source: "AI Research",
          Key: "Shor's Algorithm",
          QueryType: true,
          SourceID: "src-1",
          SourceName: "Qubit Magazine",
          Question: "What is Shor's algorithm?",
          Answer: "Shor's algorithm is a quantum computer algorithm for finding the prime factors of an integer. It runs in polynomial time, meaning it is exponentially faster than the best-known classical algorithms, which could potentially break RSA cryptography.",
          UpdatedBy: "guest@hirover.ai",
          UpdatedOn: "2026-08-01T12:00:00Z",
          Tags: "quantum, cryptography",
          UpVotedCount: 1,
          UpvotedJSON: "[\"guest@hirover.ai\"]",
          SectorFlag: 1,
          VectorFlag: "1",
          RecommendedQuestions: "[\"How to mitigate Shor's algorithm threats?\", \"What is post-quantum cryptography?\"]",
          rowID: "row-ins-1",
          jsCodes: [],
          QID: "q-quantum-1",
          Actions: { messages: [] }
        }
      ];
      localStorage.setItem(quantumInsightsKey, JSON.stringify(defaultQuantumInsights));
    }

    // 4. Reports defaults
    const quantumReportsKey = "rover_reports_quantum-computing";
    if (!localStorage.getItem(quantumReportsKey)) {
      const defaultQuantumReports = [
        {
          ReportID: "rep-quantum-1",
          ProjectID: "quantum-computing",
          Title: "Quantum Algorithms & Security Report",
          "Report Description": "A detailed study on quantum cryptanalysis and Shor's algorithm impacts.",
          Authors: "Quantum Research Team",
          CreatedOn: "2026-08-02"
        }
      ];
      localStorage.setItem(quantumReportsKey, JSON.stringify(defaultQuantumReports));
    }

    // 5. Sections defaults
    const quantumSectionsKey = "rover_report_sections_rep-quantum-1";
    if (!localStorage.getItem(quantumSectionsKey)) {
      const defaultQuantumSections = [
        {
          sectionId: "sec-1",
          section: "Executive Summary",
          content: "This report covers the threat model posed by quantum computing to RSA cryptography. We explore Shor's algorithm and recommended migration paths to Post-Quantum Cryptography (PQC).",
          prompt: "Summarize quantum security threat model"
        },
        {
          sectionId: "sec-2",
          section: "Shor's Algorithm Mechanics",
          content: "Shor's algorithm relies on the quantum Fourier transform and modular exponentiation. It finds the period of a function, which directly translates to finding the prime factors of a composite integer.",
          prompt: "Explain math behind Shor's algorithm"
        },
        {
          sectionId: "sec-3",
          section: "Recommendations",
          content: "Organizations must transition to lattice-based cryptography standards (like Kyber and Dilithium) finalized by NIST to protect against future quantum attacks.",
          prompt: "State NIST recommendations for PQC"
        }
      ];
      localStorage.setItem(quantumSectionsKey, JSON.stringify(defaultQuantumSections));
    }

    // 6. References defaults
    const quantumReferencesKey = "rover_references_rep-quantum-1";
    if (!localStorage.getItem(quantumReferencesKey)) {
      const defaultQuantumReferences = [
        {
          Reference: "NIST Post-Quantum Cryptography Standardization (2024)",
          Link: "https://csrc.nist.gov/projects/post-quantum-cryptography"
        },
        {
          Reference: "Shor, P. W. (1994). Algorithms for quantum computation: discrete logarithms and factoring.",
          Link: "https://ieeexplore.ieee.org/document/365700"
        }
      ];
      localStorage.setItem(quantumReferencesKey, JSON.stringify(defaultQuantumReferences));
    }
  };

  initMockDatabase();

  const getMockResponseText = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes("hello") || q.includes("hi ")) {
      return "Hello! I am Rover, your AI research assistant. How can I help you today with your project and report generation?";
    }
    if (q.includes("shor")) {
      return "Shor's algorithm is a quantum algorithm capable of factoring large composite integers in polynomial time. Formulated by Peter Shor in 1994, it poses a direct cryptographic threat to public-key systems like RSA and Elliptic Curve Cryptography. Migrating to lattice-based cryptography is the current standard for security.";
    }
    if (q.includes("quantum")) {
      return "Quantum computing utilizes superposition, entanglement, and interference to perform calculations. Major tech firms are currently in the noisy intermediate-scale quantum (NISQ) era, striving for logical, error-corrected qubits to run algorithms like Shor's and Grover's at scale.";
    }
    if (q.includes("generative") || q.includes("llm") || q.includes("ai")) {
      return "Generative AI and Large Language Models (LLMs) are transforming productivity but carry risks including data leakage, hallucinated outputs, and copyright disputes. Best practices for enterprise deployment include self-hosting, data auditing, and using RAG (Retrieval-Augmented Generation) for accuracy.";
    }
    return `Regarding your question "${question}", here is a synthesis of current research: \n\n1. **Core Concept**: This topic represents a rapidly developing area of study with significant interest from academia and industry.\n2. **Key Findings**: Current literature highlights the importance of standardized methodologies, robust validation, and scalability.\n3. **Future Outlook**: Ongoing developments point towards more automated tools, integration with real-time analytics, and stricter compliance frameworks. \n\nYou can use the **Report Builder** tab to compile these findings into a publication-ready document.`;
  };

  // Override window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = input.toString();

    // Check if it's one of our backend integrations
    const isMockTarget =
      urlStr.includes("ai-demo.vizru-ras.com") ||
      urlStr.includes("roverv2-qa.vizru-ras.com") ||
      urlStr.includes("workflow.exec");

    // Calls that must reach the real platform even in mock mode.
    //
    // The catch-all at the bottom of this file answers anything it does not
    // recognise with `[{ success: true }]`, which for a call that exists to
    // return a credential is indistinguishable from the workflow being broken:
    // the request never leaves the browser and the response contains no token.
    // The realtime socket cannot be mocked — it is a live server — so the
    // handshake credential has to come from the live platform too.
    const PASSTHROUGH = [
      "6a7eceb5f8dec4e8a9054b52", // socket handshake token
      "roverscriptdemo6a7ad4f143079", // film upload workflow
      "roverscriptdemodetails6a7b1a94831b3", // film metadata workflow
      "roverscriptdemocontentsparent6a7ea1c86776c", // film summarize workflow
    ];

    if (!isMockTarget || PASSTHROUGH.some((fragment) => urlStr.includes(fragment))) {
      return originalFetch(input, init);
    }

    console.log("[Mock Fetch Interceptor] Intercepted Request:", urlStr, init);

    // Extract FormData if present
    let formData: FormData | null = null;
    let dataPayload: any = null;
    if (init && init.body && init.body instanceof FormData) {
      formData = init.body;
      const dataStr = formData.get("data");
      if (dataStr) {
        try {
          dataPayload = JSON.parse(dataStr.toString())[0];
        } catch (e) {
          console.error("Failed to parse data payload from FormData", e);
        }
      }
    }

    // 0. JWT AUTH TOKEN
    if (urlStr.includes("roverv2getjwttoken692829d6ac4aa")) {
      const responseObj = [
        {
          "jwt": "mock-jwt-token-12345",
          "user-id": "usr-guest",
          "ls-id": "ls-guest",
          "user-email": "guest@hirover.ai",
          "login-username": "guest@hirover.ai"
        }
      ];
      return new Response(JSON.stringify(responseObj), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 1. GET PROJECTS LIST
    if (urlStr.includes("roverv2getprojectlistforgetstarteddashboard692945aec2c62")) {
      const projects = JSON.parse(localStorage.getItem("rover_projects") || "[]");
      const defaultQuestions = {
        "Quantum Computing Research": ["What is Shor's algorithm?", "Explain quantum supremacy.", "What is quantum error correction?"],
        "Generative AI in Enterprise": ["What are key risks of GenAI?", "How to deploy RAG systems?", "Explain LLM fine-tuning."]
      };
      
      const responseObj = [
        {
          projects: JSON.stringify(projects),
          SharedList: "[]",
          loginUsername: "guest@hirover.ai",
          questions: JSON.stringify(defaultQuestions)
        }
      ];
      return new Response(JSON.stringify(responseObj), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 2. CREATE PROJECT
    if (urlStr.includes("rovercreateprojectforgetstarted67efdd66a4730")) {
      if (dataPayload) {
        const { projectname, aiagent } = dataPayload;
        const newProject = {
          ProjectID: "proj-" + Date.now(),
          ProjectName: projectname || "Untitled Project",
          Summary: `Exploring topics related to ${projectname || "Untitled"}.`,
          AIAgent: aiagent || "Research Specialist",
          CreatedBy: "guest@hirover.ai",
          CreatedOn: new Date().toISOString().split("T")[0],
          rowid: "row-" + Date.now()
        };

        // Save to localStorage
        const projects = JSON.parse(localStorage.getItem("rover_projects") || "[]");
        projects.unshift(newProject);
        localStorage.setItem("rover_projects", JSON.stringify(projects));

        const responseObj = [
          {
            data: JSON.stringify([newProject]),
            questions: JSON.stringify({
              [newProject.ProjectName]: ["What is the main goal?", "Who are the key players?", "What are major challenges?"]
            })
          }
        ];
        return new Response(JSON.stringify(responseObj), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 3. GET CHAT HISTORY
    if (urlStr.includes("roverv2getquestionsagainstproject69259c1d9e29e")) {
      if (dataPayload) {
        const { projectid } = dataPayload;
        const historyKey = `rover_chat_history_${projectid}`;
        const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
        
        // Return default popular questions as well
        const popularQuestions = {
          "quantum-computing": ["What is Shor's algorithm?", "Explain quantum supremacy.", "What is quantum error correction?"],
          "generative-ai": ["What are key risks of GenAI?", "How to deploy RAG systems?", "Explain LLM fine-tuning."]
        };
        const questionsForProject = popularQuestions[projectid as keyof typeof popularQuestions] || [
          "What is the main goal?", "Who are the key players?", "What are major challenges?"
        ];

        const responseObj = history.map((item: any) => ({
          ...item,
          questions: JSON.stringify({ [projectid]: questionsForProject })
        }));
        
        // If empty history, still return an empty array with questions on the first item if needed, 
        // or just return the history
        if (responseObj.length === 0) {
          responseObj.push({
            Question: "",
            Answer: "",
            QID: "",
            questions: JSON.stringify({ [projectid]: questionsForProject })
          });
        }

        return new Response(JSON.stringify(responseObj), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 4. ASK ROVER / STREAMING CHAT
    if (urlStr.includes("ask-rover") || urlStr.includes("ask-insight") || urlStr.includes("ask-document")) {
      const question = formData ? formData.get("question")?.toString() || "" : "";
      const projectId = formData ? formData.get("project_id")?.toString() || "" : "";
      const answer = getMockResponseText(question);
      const qid = "q-" + Date.now();

      // Save Q&A to chat history localStorage
      if (projectId) {
        const historyKey = `rover_chat_history_${projectId}`;
        const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
        history.unshift({
          Question: question,
          Answer: answer,
          QID: qid,
          UpvotedJSON: "[]",
          UpVotedCount: 0
        });
        localStorage.setItem(historyKey, JSON.stringify(history));
      }

      // Create SSE Stream Response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Split answer by words to stream dynamically
          const words = answer.split(/(\s+)/);
          
          for (const word of words) {
            if (word.length === 0) continue;
            // Write SSE chunk format
            controller.enqueue(encoder.encode(`data:${word}\n\n`));
            // Simulate networking delay
            await new Promise((resolve) => setTimeout(resolve, 30));
          }

          // Done event
          const donePayload = {
            answer,
            qid,
            userlist: "[]",
            count: 0
          };
          controller.enqueue(encoder.encode(`event:done\ndata:${JSON.stringify(donePayload)}\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    // 5. GET INSIGHTS LIST
    if (urlStr.includes("roverv2getmyinsights692431386908a")) {
      if (dataPayload) {
        const { projectid } = dataPayload;
        const insights = JSON.parse(localStorage.getItem(`rover_insights_${projectid}`) || "[]");
        return new Response(JSON.stringify(insights), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 6. SAVE/VOTE INSIGHT
    if (urlStr.includes("roverv2voting695e06fb20368")) {
      if (dataPayload) {
        const { qid, type, count, userlist } = dataPayload;
        // Search across all chat histories to find the question and answer to save
        const projects = JSON.parse(localStorage.getItem("rover_projects") || "[]");
        let matchedMsg: any = null;
        let matchedProjId = "";

        for (const p of projects) {
          const history = JSON.parse(localStorage.getItem(`rover_chat_history_${p.ProjectID}`) || "[]");
          const msg = history.find((m: any) => m.QID === qid);
          if (msg) {
            matchedMsg = msg;
            matchedProjId = p.ProjectID;
            break;
          }
        }

        if (matchedMsg && matchedProjId) {
          const insightsKey = `rover_insights_${matchedProjId}`;
          const insights = JSON.parse(localStorage.getItem(insightsKey) || "[]");
          
          if (type === "1") {
            // Add to insights
            const isAlreadySaved = insights.some((i: any) => i.QID === qid);
            if (!isAlreadySaved) {
              insights.unshift({
                ProjectID: matchedProjId,
                Source: "AI Assistant",
                Key: matchedMsg.Question.slice(0, 20),
                QueryType: true,
                SourceID: "src-" + Date.now(),
                SourceName: "Rover Platform",
                Question: matchedMsg.Question,
                Answer: matchedMsg.Answer,
                UpdatedBy: "guest@hirover.ai",
                UpdatedOn: new Date().toISOString(),
                Tags: "Saved, AI",
                UpVotedCount: Number(count) || 1,
                UpvotedJSON: userlist || "[\"guest@hirover.ai\"]",
                SectorFlag: 1,
                VectorFlag: "1",
                RecommendedQuestions: "[]",
                rowID: "row-ins-" + Date.now(),
                jsCodes: [],
                QID: qid,
                Actions: { messages: [] }
              });
              localStorage.setItem(insightsKey, JSON.stringify(insights));
            }
          } else {
            // Remove from insights
            const updated = insights.filter((i: any) => i.QID !== qid);
            localStorage.setItem(insightsKey, JSON.stringify(updated));
          }
        }

        return new Response(JSON.stringify([{ success: true }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 9. ARCHIVE PROJECT
    if (urlStr.includes("roverprojectarchive66603dce19f00")) {
      if (dataPayload) {
        const { rowid } = dataPayload;
        const projects = JSON.parse(localStorage.getItem("rover_projects") || "[]");
        const filtered = projects.filter((p: any) => p.rowid !== rowid);
        localStorage.setItem("rover_projects", JSON.stringify(filtered));
        return new Response(JSON.stringify([{ success: true }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 10. ARCHIVE INSIGHTS
    if (urlStr.includes("rovermyinsightsarchiveunarchive670ce78016abf")) {
      if (dataPayload) {
        const { qid, dna_filter_val } = dataPayload;
        const insightsKey = `rover_insights_${dna_filter_val}`;
        const insights = JSON.parse(localStorage.getItem(insightsKey) || "[]");
        const filtered = insights.filter((i: any) => i.QID !== qid);
        localStorage.setItem(insightsKey, JSON.stringify(filtered));
        return new Response(JSON.stringify([{ success: true }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 11. TRANSLATE ANSWER
    if (urlStr.includes("rovertranslatetext6655997db8938")) {
      if (dataPayload) {
        const { input } = dataPayload;
        return new Response(
          JSON.stringify([
            {
              ConvertedData: `[Translated] ${input}`,
              LanguageCode: "EN"
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 24. STRIPE PAYMENT/PRICING
    if (urlStr.includes("createstripecheckoutsession68faedae08428")) {
      return new Response(JSON.stringify([{ url: "/projects" }]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlStr.includes("roverv2stripepaymentdetails695f4afdd30a0")) {
      return new Response(
        JSON.stringify([
          {
            amount: 0,
            status: "active",
            plan: "Free Developer Sandbox"
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fallback for other workflow executions
    return new Response(JSON.stringify([{ success: true }]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
