// Terminology layer. The default surface speaks to dietitians (care plans,
// clients); flipping a workspace into Research mode restores the original
// researcher vocabulary. Data models are unchanged — studies/participants
// underneath — so the research surface stays reactivatable.

export function lingoFor(researchMode) {
  return researchMode
    ? {
        research: true,
        console: "Researcher console",
        plan: "Study",
        plans: "Studies",
        planLower: "study",
        plansLower: "studies",
        client: "Participant",
        clients: "Participants",
        clientLower: "participant",
        clientsLower: "participants",
        team: "study team",
        privacy: "Data handling",
        enrollVerb: "Add participant",
      }
    : {
        research: false,
        console: "Practitioner console",
        plan: "Care plan",
        plans: "Care plans",
        planLower: "care plan",
        plansLower: "care plans",
        client: "Client",
        clients: "Clients",
        clientLower: "client",
        clientsLower: "clients",
        team: "dietitian",
        privacy: "Privacy & compliance",
        enrollVerb: "Invite client",
      };
}

// Client-facing copy is driven by the plan itself (a research study keeps
// "study team" language even if viewed while the workspace is in care mode).
export function teamLabelForStudy(study) {
  return study?.surface === "research" ? "your study team" : "your dietitian";
}
