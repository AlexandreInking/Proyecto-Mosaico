import { customNodeDefinitionSchema, type CustomExpression, type CustomNodeDefinition, type CustomNodeParameter, type CustomNodePort, type PipelinePort } from '@mosaico/contracts'

export const CUSTOM_OPERATIONS = ['resize', 'flip', 'rotate', 'zoom', 'invert', 'select', 'replace', 'outline', 'blend', 'add', 'subtract', 'multiply', 'divide', 'color', 'gradient'] as const
export type CustomOperation = typeof CUSTOM_OPERATIONS[number]

export interface CustomNodeDiagnostic { readonly line?: number; readonly message: string }
export interface CustomNodeParseResult { readonly definition?: CustomNodeDefinition; readonly diagnostics: readonly CustomNodeDiagnostic[] }

const typeNames: Record<string, PipelinePort['type']> = {
  surface: 'surface', Surface: 'surface', color: 'color', Color: 'color', gradient: 'gradient', Gradient: 'gradient',
  value: 'value', Value: 'value', int: 'int', Int: 'int', float: 'float', Float: 'float', bool: 'bool', Bool: 'bool', boolean: 'bool', Boolean: 'bool',
  vector2: 'vector2', Vector2: 'vector2', vector3: 'vector3', Vector3: 'vector3', vector4: 'vector4', Vector4: 'vector4',
  array: 'array', Array: 'array', point: 'point', Point: 'point', path: 'path', Path: 'path', matrix: 'matrix', Matrix: 'matrix', string: 'string', String: 'string',
}

const tokens = (source: string): string[] => {
  const result: string[] = []; const pattern = /\s*(=>|[()+\-*/\[\],]|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?:\d+(?:\.\d+)?)|[A-Za-z_][A-Za-z0-9_]*)/g
  let cursor = 0
  while (cursor < source.length) {
    pattern.lastIndex = cursor; const match = pattern.exec(source)
    if (!match || match.index !== cursor) throw new Error('Unexpected token')
    result.push(match[1]!); cursor = pattern.lastIndex
  }
  return result
}

function expressionParser(source: string): CustomExpression {
  const input = tokens(source); let cursor = 0
  const peek = () => input[cursor]
  const primary = (): CustomExpression => {
    const token = peek(); if (!token) throw new Error('Expression is incomplete')
    cursor += 1
    if (token === '(') { const value = binary(0); if (peek() !== ')') throw new Error('Missing closing parenthesis'); cursor += 1; return value }
    if (/^\d/.test(token)) return { kind: 'literal', value: Number(token) }
    if (token === 'true' || token === 'false') return { kind: 'literal', value: token === 'true' }
    if (token.startsWith('"') || token.startsWith("'")) return { kind: 'literal', value: token.slice(1, -1) }
    if (peek() === '(') {
      cursor += 1; const args: CustomExpression[] = []
      if (peek() !== ')') while (true) { args.push(binary(0)); if (peek() !== ',') break; cursor += 1 }
      if (peek() !== ')') throw new Error('Missing closing parenthesis'); cursor += 1
      return { kind: 'call', name: token, args }
    }
    return { kind: 'ref', ref: token }
  }
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }
  function binary(minPrecedence: number): CustomExpression {
    let left = primary()
    while (true) {
      const operator = peek(); const priority = operator ? precedence[operator] : undefined
      if (priority === undefined || priority < minPrecedence) break
      cursor += 1; const right = binary(priority + 1); left = { kind: 'binary', operator: operator as '+' | '-' | '*' | '/', left, right }
    }
    return left
  }
  const expression = binary(0)
  if (cursor !== input.length) throw new Error('Unexpected expression tail')
  return expression
}

function valueType(value: unknown): string {
  if (typeof value === 'number') return 'float'
  if (typeof value === 'boolean') return 'bool'
  if (typeof value === 'string') return 'text'
  if (Array.isArray(value)) return value.every((item) => typeof item === 'number') ? `vector${Math.min(4, Math.max(2, value.length))}` : 'array'
  return 'unknown'
}

function inferExpression(expression: CustomExpression, symbols: ReadonlyMap<string, string>, diagnostics: CustomNodeDiagnostic[]): string {
  if (expression.kind === 'literal') return valueType(expression.value)
  if (expression.kind === 'ref') {
    const type = symbols.get(expression.ref)
    if (!type) diagnostics.push({ message: `Unknown input or parameter: ${expression.ref}` })
    return type ?? 'unknown'
  }
  if (expression.kind === 'binary') {
    const left = inferExpression(expression.left, symbols, diagnostics); const right = inferExpression(expression.right, symbols, diagnostics)
    const numeric = new Set(['float', 'int', 'value', 'vector2', 'vector3', 'vector4'])
    if (!numeric.has(left) || !numeric.has(right)) diagnostics.push({ message: `Operator ${expression.operator} requires numeric values.` })
    return left.startsWith('vector') ? left : right.startsWith('vector') ? right : 'float'
  }
  if (!CUSTOM_OPERATIONS.includes(expression.name as CustomOperation)) { diagnostics.push({ message: `Operation is not registered: ${expression.name}` }); return 'unknown' }
  const args = expression.args.map((arg) => inferExpression(arg, symbols, diagnostics))
  if (['invert', 'resize', 'flip', 'rotate', 'zoom', 'select', 'replace', 'outline', 'blend', 'color', 'gradient'].includes(expression.name) && expression.name !== 'color' && expression.name !== 'gradient' && args[0] !== 'surface') diagnostics.push({ message: `${expression.name} expects a Surface input.` })
  if (['add', 'subtract', 'multiply', 'divide'].includes(expression.name) && !args.some((type) => type === 'surface' || type === 'float' || type.startsWith('vector'))) diagnostics.push({ message: `${expression.name} expects numeric or Surface inputs.` })
  return ['add', 'subtract', 'multiply', 'divide'].includes(expression.name) && !args.includes('surface') ? (args.find((type) => type.startsWith('vector')) ?? 'float') : 'surface'
}

function parsePort(line: string, direction: 'input' | 'output'): CustomNodePort | undefined {
  const match = line.match(/^(?:input|output)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)$/)
  if (!match) return undefined
  const type = typeNames[match[2]!]
  if (!type) return undefined
  return { id: match[1]!, label: match[1]!, type, direction, showInNode: true }
}

export function parseCustomNodeDsl(source: string, name: string, family = 'Custom'): CustomNodeParseResult {
  const diagnostics: CustomNodeDiagnostic[] = []; const inputs: CustomNodePort[] = []; const outputs: CustomNodePort[] = []; const parameters: CustomNodeParameter[] = []; const body: Record<string, CustomExpression> = {}
  const lines = source.split(/\r?\n/).map((line) => line.replace(/#.*$/, '').trim()).filter(Boolean)
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1
    const portMatch = line.match(/^(input|output)\s+/)
    if (portMatch) {
      const port = parsePort(line, portMatch[1] as 'input' | 'output')
      if (!port) diagnostics.push({ line: lineNumber, message: `Invalid ${portMatch[1]} declaration.` }); else (port.direction === 'input' ? inputs : outputs).push(port)
      continue
    }
    const parameter = line.match(/^param\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)(?:\s*=\s*(.+))?$/)
    if (parameter) {
      const type = parameter[2] === 'Float' || parameter[2] === 'float' ? 'float' : parameter[2] === 'Int' || parameter[2] === 'int' ? 'number' : parameter[2] === 'Bool' || parameter[2] === 'bool' || parameter[2] === 'Boolean' || parameter[2] === 'boolean' ? 'boolean' : parameter[2] === 'Array' || parameter[2] === 'array' ? 'array' : parameter[2] === 'Color' || parameter[2] === 'color' ? 'color' : 'text'
      let value: string | number | boolean | (string | number | boolean)[] = type === 'number' || type === 'float' ? 0 : type === 'boolean' ? false : type === 'array' ? [] : type === 'color' ? '#ffffff' : ''
      if (parameter[3]) try { const parsed = expressionParser(parameter[3]); if (parsed.kind !== 'literal' || typeof parsed.value === 'object') throw new Error('Parameter default must be a literal'); value = parsed.value as string | number | boolean } catch { diagnostics.push({ line: lineNumber, message: `Invalid default value for parameter ${parameter[1]}.` }) }
      const portType = type === 'boolean' ? 'bool' : type === 'float' ? 'float' : type === 'number' ? 'value' : type === 'array' ? 'array' : type === 'color' ? 'color' : 'value'
      parameters.push({ id: parameter[1]!, label: parameter[1]!, type, value, portType, showInNode: true }); continue
    }
    const assignment = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (assignment) { try { body[assignment[1]!] = expressionParser(assignment[2]!) } catch (error) { diagnostics.push({ line: lineNumber, message: error instanceof Error ? error.message : 'Invalid expression.' }) }; continue }
    diagnostics.push({ line: lineNumber, message: 'Unknown DSL statement.' })
  }
  const symbols = new Map<string, string>([...inputs.map((item) => [item.id, item.type] as const), ...parameters.map((item) => [item.id, item.type === 'number' ? 'float' : item.type] as const)])
  for (const output of outputs) {
    const expression = body[output.id]
    if (!expression) { diagnostics.push({ message: `Output is not assigned: ${output.id}` }); continue }
    const inferred = inferExpression(expression, symbols, diagnostics)
    if (inferred !== 'unknown' && inferred !== output.type && !(output.type === 'value' && ['float', 'int'].includes(inferred))) diagnostics.push({ message: `Output ${output.id} expects ${output.type}, got ${inferred}.` })
  }
  const candidate = { id: `custom-${crypto.randomUUID()}`, version: 1, name: name.trim(), family: family.trim() || 'Custom', inputs, outputs, parameters, body }
  const parsed = customNodeDefinitionSchema.safeParse(candidate)
  if (!parsed.success) diagnostics.push({ message: 'Custom node schema is invalid.' })
  if (!name.trim()) diagnostics.push({ message: 'Custom node name is required.' })
  return diagnostics.length || !parsed.success ? { diagnostics } : { definition: parsed.data, diagnostics }
}

export function createVisualCustomNodeDefinition(input: { name: string; family?: string; inputs: readonly CustomNodePort[]; outputs: readonly CustomNodePort[]; parameters?: readonly CustomNodeParameter[]; operation: CustomOperation }): CustomNodeDefinition {
  const firstInput = input.inputs[0]
  const body: Record<string, CustomExpression> = {}
  for (const output of input.outputs) body[output.id] = { kind: 'call', name: input.operation, args: firstInput ? [{ kind: 'ref', ref: firstInput.id }] : [] }
  return customNodeDefinitionSchema.parse({ id: `custom-${crypto.randomUUID()}`, version: 1, name: input.name.trim(), family: input.family?.trim() || 'Custom', inputs: input.inputs, outputs: input.outputs, parameters: input.parameters ?? [], body })
}
