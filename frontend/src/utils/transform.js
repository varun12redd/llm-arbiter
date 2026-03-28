export function transformResponse(data) {
  function clean(text) {
    return text
      ?.replace(/^["']|["']$/g, "")
      ?.replace(/\*\*/g, "")
      ?.trim();
  }

  const providersMap = {};

  Object.values(data.providers).forEach((p) => {
    providersMap[p.provider] = {
      ...p,
      output: clean(p.output),
    };
  });

  const providers = Object.values(providersMap);

  const race = providers.filter((p) => p.status === "ok");

  return {
    arena: providers,
    race,
    winner: {
      provider: data.selected_provider,
      answer: clean(data.final_answer),
    },
  };
}