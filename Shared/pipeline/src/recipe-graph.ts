import { recipeSchema, type Recipe, type RecipeStep } from '@mosaico/contracts'

export function orderRecipeSteps(recipeInput: Recipe): RecipeStep[] {
  const recipe = recipeSchema.parse(recipeInput)
  const stepsById = new Map<string, RecipeStep>()
  for (const step of recipe.steps) {
    if (stepsById.has(step.id)) throw new Error(`La receta contiene el ID duplicado ${step.id}.`)
    stepsById.set(step.id, step)
  }

  const dependentIds = new Map<string, string[]>()
  const pendingDependencies = new Map<string, number>()
  for (const step of recipe.steps) {
    pendingDependencies.set(step.id, step.dependsOn.length)
    for (const dependencyId of step.dependsOn) {
      if (!stepsById.has(dependencyId)) throw new Error(`La dependencia ${dependencyId} no existe.`)
      const dependents = dependentIds.get(dependencyId) ?? []
      dependents.push(step.id)
      dependentIds.set(dependencyId, dependents)
    }
  }

  const ready = recipe.steps.filter((step) => step.dependsOn.length === 0).map((step) => step.id)
  const ordered: RecipeStep[] = []
  while (ready.length > 0) {
    const id = ready.shift()
    if (!id) break
    const step = stepsById.get(id)
    if (!step) throw new Error(`El paso ${id} no existe.`)
    ordered.push(step)
    for (const dependentId of dependentIds.get(id) ?? []) {
      const remaining = (pendingDependencies.get(dependentId) ?? 0) - 1
      pendingDependencies.set(dependentId, remaining)
      if (remaining === 0) ready.push(dependentId)
    }
  }

  if (ordered.length !== recipe.steps.length) throw new Error('La receta contiene un ciclo de dependencias.')
  return ordered
}
