# I3-00 V2 — Contratos tipados MVP M1/M2

## Modelo de execução

As dez ferramentas abaixo são **contratos propostos**, não endpoints existentes. Os exemplos são fixtures **inteiramente sintéticas**. scopeRef é um identificador opaco criado e validado em MAIN; o modelo não recebe token, owner ou SQL. Campos extras são rejeitados (additionalProperties=false). Erros de segurança nunca são transformados em sucesso silencioso. O esquema JSON 2020-12 é normativo, incluindo validação de format date/date-time e semântica adicional start≤end. Revalidar grant e dataVersion antes e depois de cada chamada.

**Importante:** a fixture de banco usa rótulo lógico isolado de teste; não há conta real, nem profile demo com bank (combinação negada pelo código atual). source/owner/profile são resolvidos no MAIN por scopeRef, não recebidos do modelo.

**Contrato por status:** os `OutputSchema` usam `oneOf`. `ready`/`partial` exigem dataVersion, asOf, coverage, source e data; `partial` exige warnings. Respostas `denied`, `stale`, `no_data`, `unsupported` e `error` contêm apenas status, code e message: nenhuma autorização negada é representada por valores financeiros fictícios.

**Taxonomia D05:** somente IDs confirmados em `electron/d05-taxonomy.json`, incluindo `cat:alimentacao`, `cat:transporte`, `cat:assinaturas`, `cat:contas` e `sub:contas/seguros`. Categoria de texto legado exige resolução explícita e tratamento de ambiguidade; não inferir ID silenciosamente.

### Registro tipado (JSON válido)

## 1. read_transactions_range — Return one safely paginated interval of canonical POSTED rows, excluding transfer/ignored from expense totals

**Reuso:** FinanceDB.bankOverview/load + shared/finance-period-ledger.mjs. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** DENIED, STALE, INVALID_DATE, INVALID_CURSOR, PARTIAL_COVERAGE. **Limites/paginação:** limit≤100, stable cursor bound to scope+dataVersion; do not infer complete from 2500 cap. **Testes:** T-001,T-019,T-020,T-030,T-045. **Aceite:** Rows and month total reconcile exactly; 2600→2500 must be PARTIAL and never silently complete.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "start",
    "end",
    "limit"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "start": {
      "type": "string",
      "format": "date"
    },
    "end": {
      "type": "string",
      "format": "date"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "cursor": {
      "type": [
        "string",
        "null"
      ],
      "maxLength": 256
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "rows",
            "nextCursor",
            "expensesCents"
          ],
          "properties": {
            "rows": {
              "type": "array",
              "maxItems": 100,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "id",
                  "date",
                  "amountCents",
                  "categoryId",
                  "subcategoryId"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "date": {
                    "type": "string",
                    "format": "date"
                  },
                  "amountCents": {
                    "type": "integer"
                  },
                  "categoryId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "subcategoryId": {
                    "type": [
                      "string",
                      "null"
                    ],
                    "maxLength": 80
                  },
                  "merchant": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                }
              }
            },
            "nextCursor": {
              "type": [
                "string",
                "null"
              ],
              "maxLength": 256
            },
            "expensesCents": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "rows",
            "nextCursor",
            "expensesCents"
          ],
          "properties": {
            "rows": {
              "type": "array",
              "maxItems": 100,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "id",
                  "date",
                  "amountCents",
                  "categoryId",
                  "subcategoryId"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "date": {
                    "type": "string",
                    "format": "date"
                  },
                  "amountCents": {
                    "type": "integer"
                  },
                  "categoryId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "subcategoryId": {
                    "type": [
                      "string",
                      "null"
                    ],
                    "maxLength": 80
                  },
                  "merchant": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                }
              }
            },
            "nextCursor": {
              "type": [
                "string",
                "null"
              ],
              "maxLength": 256
            },
            "expensesCents": {
              "type": "integer",
              "minimum": 0
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f1-bank",
  "start": "2026-11-01",
  "end": "2026-11-30",
  "limit": 100
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "n01",
    "n02",
    "n03",
    "n04"
  ],
  "method": "canonical_ledger",
  "data": {
    "rows": [
      {
        "id": "n01",
        "date": "2026-11-03",
        "amountCents": -15000,
        "categoryId": "cat:alimentacao",
        "subcategoryId": null,
        "merchant": "Mercado Exemplo"
      },
      {
        "id": "n02",
        "date": "2026-11-05",
        "amountCents": -12000,
        "categoryId": "cat:assinaturas",
        "subcategoryId": null,
        "merchant": "StreamCo"
      },
      {
        "id": "n03",
        "date": "2026-11-11",
        "amountCents": -9000,
        "categoryId": "cat:transporte",
        "subcategoryId": null,
        "merchant": "App Transporte"
      },
      {
        "id": "n04",
        "date": "2026-11-15",
        "amountCents": -6000,
        "categoryId": "cat:contas",
        "subcategoryId": "sub:contas/seguros",
        "merchant": "Seguro Exemplo"
      }
    ],
    "nextCursor": null,
    "expensesCents": 42000
  }
}
```

## 2. aggregate_category_spend — Aggregate parent/child D05 spending without double-counting split transactions

**Reuso:** FinancialReadTools.categories + D05 category service + ledger. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** CATEGORY_AMBIGUOUS, DENIED, STALE, INVALID_HIERARCHY. **Limites/paginação:** 1 exact category ID, null explicit, page retrieval delegated. **Testes:** T-004,T-008,T-009,T-011,T-012. **Aceite:** Child sums match parent and source IDs; no textual fallback for ambiguous names.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "start",
    "end",
    "categoryId",
    "subcategoryId"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "start": {
      "type": "string",
      "format": "date"
    },
    "end": {
      "type": "string",
      "format": "date"
    },
    "categoryId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    },
    "subcategoryId": {
      "type": [
        "string",
        "null"
      ],
      "maxLength": 80
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "categoryId",
            "subcategoryId",
            "spentCents",
            "count"
          ],
          "properties": {
            "categoryId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 80
            },
            "subcategoryId": {
              "type": [
                "string",
                "null"
              ],
              "maxLength": 80
            },
            "spentCents": {
              "type": "integer",
              "minimum": 0
            },
            "count": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "categoryId",
            "subcategoryId",
            "spentCents",
            "count"
          ],
          "properties": {
            "categoryId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 80
            },
            "subcategoryId": {
              "type": [
                "string",
                "null"
              ],
              "maxLength": 80
            },
            "spentCents": {
              "type": "integer",
              "minimum": 0
            },
            "count": {
              "type": "integer",
              "minimum": 0
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f1-bank",
  "start": "2026-11-01",
  "end": "2026-11-30",
  "categoryId": "cat:alimentacao",
  "subcategoryId": null
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "n01"
  ],
  "method": "ledger_d05",
  "data": {
    "categoryId": "cat:alimentacao",
    "subcategoryId": null,
    "spentCents": 15000,
    "count": 1
  }
}
```

## 3. compare_merchant_periods — Compare merchant-normalized spend and frequency across exactly two selected periods

**Reuso:** FinancialReadTools.merchants + FinanceDB. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** MERCHANT_AMBIGUOUS, PARTIAL_COVERAGE, DENIED. **Limites/paginação:** 1 merchant, fixed max 12 months per follow-up, no naive string identity. **Testes:** T-014,T-018,T-026. **Aceite:** delta=3000 cents, frequency and average ticket independently calculable; ambiguity explicit.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "periodA",
    "periodB",
    "merchantId"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "periodA": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}$"
    },
    "periodB": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}$"
    },
    "merchantId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "merchantId",
            "amountACents",
            "amountBCents",
            "deltaCents",
            "countA",
            "countB"
          ],
          "properties": {
            "merchantId": {
              "type": "string"
            },
            "amountACents": {
              "type": "integer"
            },
            "amountBCents": {
              "type": "integer"
            },
            "deltaCents": {
              "type": "integer"
            },
            "countA": {
              "type": "integer",
              "minimum": 0
            },
            "countB": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "merchantId",
            "amountACents",
            "amountBCents",
            "deltaCents",
            "countA",
            "countB"
          ],
          "properties": {
            "merchantId": {
              "type": "string"
            },
            "amountACents": {
              "type": "integer"
            },
            "amountBCents": {
              "type": "integer"
            },
            "deltaCents": {
              "type": "integer"
            },
            "countA": {
              "type": "integer",
              "minimum": 0
            },
            "countB": {
              "type": "integer",
              "minimum": 0
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f1-bank",
  "periodA": "2026-10",
  "periodB": "2026-11",
  "merchantId": "merchant-mercado-exemplo"
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "p01",
    "n01"
  ],
  "method": "merchant_normalize_group",
  "data": {
    "merchantId": "merchant-mercado-exemplo",
    "amountACents": 12000,
    "amountBCents": 15000,
    "deltaCents": 3000,
    "countA": 1,
    "countB": 1
  }
}
```

## 4. detect_recurring_candidates — Identify probable repeating charges, not confirmed subscriptions

**Reuso:** Monthly merchant groups + FinanceDB/ledger; NOT I2-D category quality substitute. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** INSUFFICIENT_MONTHS, AMBIGUOUS_MERCHANT, PARTIAL_COVERAGE. **Limites/paginação:** ≤12 months, ≤25 candidates; no external cancellation. **Testes:** T-017,T-021,T-046. **Aceite:** StreamCo labelled candidate, not guaranteed subscription; never infer cancelability.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "start",
    "end",
    "minOccurrences"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "start": {
      "type": "string",
      "format": "date"
    },
    "end": {
      "type": "string",
      "format": "date"
    },
    "minOccurrences": {
      "type": "integer",
      "minimum": 2,
      "maximum": 12
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "candidates"
          ],
          "properties": {
            "candidates": {
              "type": "array",
              "maxItems": 25,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "merchantId",
                  "observedMonths",
                  "amountRangeCents",
                  "certainty"
                ],
                "properties": {
                  "merchantId": {
                    "type": "string"
                  },
                  "observedMonths": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "pattern": "^\\d{4}-\\d{2}$"
                    },
                    "minItems": 2
                  },
                  "amountRangeCents": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "minimum": 0
                    },
                    "minItems": 2,
                    "maxItems": 2
                  },
                  "certainty": {
                    "type": "string",
                    "enum": [
                      "candidate",
                      "strong_candidate"
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "candidates"
          ],
          "properties": {
            "candidates": {
              "type": "array",
              "maxItems": 25,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "merchantId",
                  "observedMonths",
                  "amountRangeCents",
                  "certainty"
                ],
                "properties": {
                  "merchantId": {
                    "type": "string"
                  },
                  "observedMonths": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "pattern": "^\\d{4}-\\d{2}$"
                    },
                    "minItems": 2
                  },
                  "amountRangeCents": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "minimum": 0
                    },
                    "minItems": 2,
                    "maxItems": 2
                  },
                  "certainty": {
                    "type": "string",
                    "enum": [
                      "candidate",
                      "strong_candidate"
                    ]
                  }
                }
              }
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f1-bank",
  "start": "2026-10-01",
  "end": "2026-11-30",
  "minOccurrences": 2
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "p04",
    "n02"
  ],
  "method": "periodic_observations",
  "data": {
    "candidates": [
      {
        "merchantId": "streamco",
        "observedMonths": [
          "2026-10",
          "2026-11"
        ],
        "amountRangeCents": [
          12000,
          12000
        ],
        "certainty": "candidate"
      }
    ]
  }
}
```

## 5. read_budget_tree — Read hierarchical limit/spend and explicit zero distinct from missing null

**Reuso:** FinanceDB.budgets, budgetProgress and D05; B02 is UI not truth. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** MISSING_BUDGET, AMBIGUOUS_CATEGORY, DENIED. **Limites/paginação:** ≤20 IDs; missing is null, explicit limit zero is 0. **Testes:** T-006,T-016,T-049. **Aceite:** Zero budget triggers risk and never divide by zero; budget values do not mutate.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "month",
    "categoryIds"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "month": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}$"
    },
    "categoryIds": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 80
      },
      "minItems": 1,
      "maxItems": 20
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items"
          ],
          "properties": {
            "items": {
              "type": "array",
              "maxItems": 20,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "categoryId",
                  "limitCents",
                  "spentCents",
                  "exceeded"
                ],
                "properties": {
                  "categoryId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "limitCents": {
                    "type": [
                      "integer",
                      "null"
                    ],
                    "minimum": 0
                  },
                  "spentCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "exceeded": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items"
          ],
          "properties": {
            "items": {
              "type": "array",
              "maxItems": 20,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "categoryId",
                  "limitCents",
                  "spentCents",
                  "exceeded"
                ],
                "properties": {
                  "categoryId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 80
                  },
                  "limitCents": {
                    "type": [
                      "integer",
                      "null"
                    ],
                    "minimum": 0
                  },
                  "spentCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "exceeded": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f1-bank",
  "month": "2026-11",
  "categoryIds": [
    "cat:assinaturas"
  ]
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "n02"
  ],
  "method": "budgetProgress_d05",
  "data": {
    "items": [
      {
        "categoryId": "cat:assinaturas",
        "limitCents": 0,
        "spentCents": 12000,
        "exceeded": true
      }
    ]
  }
}
```

## 6. read_commitments — Read confirmed remaining future commitments, excluding cancelled and paid

**Reuso:** PlanningStore.list + LocalFinancialIntelligence.commitments. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** PLANNING_CONSENT_REQUIRED, DENIED, PARTIAL_COVERAGE. **Limites/paginação:** ≤12 months and ≤100 items; remaining>0 only. **Testes:** T-010,T-023,T-025. **Aceite:** Sum=115000, planned income not received and no false starting balance.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "start",
    "end"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "start": {
      "type": "string",
      "format": "date"
    },
    "end": {
      "type": "string",
      "format": "date"
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items",
            "totalRemainingCents"
          ],
          "properties": {
            "items": {
              "type": "array",
              "maxItems": 100,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "id",
                  "dueDate",
                  "remainingCents"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "dueDate": {
                    "type": "string",
                    "format": "date"
                  },
                  "remainingCents": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            },
            "totalRemainingCents": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items",
            "totalRemainingCents"
          ],
          "properties": {
            "items": {
              "type": "array",
              "maxItems": 100,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "id",
                  "dueDate",
                  "remainingCents"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "dueDate": {
                    "type": "string",
                    "format": "date"
                  },
                  "remainingCents": {
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            },
            "totalRemainingCents": {
              "type": "integer",
              "minimum": 0
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f2-planning",
  "start": "2026-12-01",
  "end": "2026-12-31"
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f2",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "manual",
  "sourceIds": [
    "rent-dec",
    "internet-dec"
  ],
  "method": "planning_confirmed_remaining",
  "data": {
    "items": [
      {
        "id": "rent-dec",
        "dueDate": "2026-12-05",
        "remainingCents": 95000
      },
      {
        "id": "internet-dec",
        "dueDate": "2026-12-15",
        "remainingCents": 20000
      }
    ],
    "totalRemainingCents": 115000
  }
}
```

## 7. recommend_savings — Generate ranked, non-overlapping savings opportunities with viability statement

**Reuso:** read_transactions_range + merchant trends + recurring + budget + planning evidence. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** INSUFFICIENT_EVIDENCE, OVERLAPPING_CANDIDATES, STALE. **Limites/paginação:** ≤50 facts input/10 output, no guaranteed savings from unconfirmed subscription. **Testes:** T-021,T-027 plus J1 master fixture. **Aceite:** If max plausible=23000<30000, report goal not verified instead of promising R$300.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "evidenceRefs",
    "targetCents"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "evidenceRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 100
      },
      "minItems": 1,
      "maxItems": 50,
      "uniqueItems": true
    },
    "targetCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 999999999
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "opportunities",
            "maxIndependentSavingsCents",
            "targetVerified"
          ],
          "properties": {
            "opportunities": {
              "type": "array",
              "maxItems": 10,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "insightId",
                  "minSaveCents",
                  "maxSaveCents",
                  "overlapGroup",
                  "confidence"
                ],
                "properties": {
                  "insightId": {
                    "type": "string"
                  },
                  "minSaveCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "maxSaveCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "overlapGroup": {
                    "type": "string"
                  },
                  "confidence": {
                    "type": "string",
                    "enum": [
                      "low",
                      "medium",
                      "high"
                    ]
                  }
                }
              }
            },
            "maxIndependentSavingsCents": {
              "type": "integer",
              "minimum": 0
            },
            "targetVerified": {
              "type": "boolean"
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "opportunities",
            "maxIndependentSavingsCents",
            "targetVerified"
          ],
          "properties": {
            "opportunities": {
              "type": "array",
              "maxItems": 10,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "insightId",
                  "minSaveCents",
                  "maxSaveCents",
                  "overlapGroup",
                  "confidence"
                ],
                "properties": {
                  "insightId": {
                    "type": "string"
                  },
                  "minSaveCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "maxSaveCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "overlapGroup": {
                    "type": "string"
                  },
                  "confidence": {
                    "type": "string",
                    "enum": [
                      "low",
                      "medium",
                      "high"
                    ]
                  }
                }
              }
            },
            "maxIndependentSavingsCents": {
              "type": "integer",
              "minimum": 0
            },
            "targetVerified": {
              "type": "boolean"
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f-master",
  "evidenceRefs": [
    "ev-delivery",
    "ev-other",
    "ev-streamco"
  ],
  "targetCents": 30000
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-master-v1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "ev-delivery",
    "ev-other",
    "ev-streamco"
  ],
  "method": "rank_non_overlapping_candidates",
  "data": {
    "opportunities": [
      {
        "insightId": "cut-delivery",
        "minSaveCents": 12000,
        "maxSaveCents": 15000,
        "overlapGroup": "delivery",
        "confidence": "medium"
      },
      {
        "insightId": "cut-other",
        "minSaveCents": 0,
        "maxSaveCents": 3000,
        "overlapGroup": "other",
        "confidence": "low"
      },
      {
        "insightId": "review-streamco",
        "minSaveCents": 0,
        "maxSaveCents": 5000,
        "overlapGroup": "subscription",
        "confidence": "low"
      }
    ],
    "maxIndependentSavingsCents": 23000,
    "targetVerified": false
  }
}
```

## 8. simulate_savings — Simulate amounts from approved opportunity references; do not let LLM assert totals

**Reuso:** FinancialReadTools.simulate + deterministic what-if composition. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** INVALID_OPPORTUNITY, OVERLAPPING_CANDIDATES, STALE. **Limites/paginação:** ≤25 opportunity refs, three scenarios max, pure what-if, no writes. **Testes:** T-015,T-022,T-027; J1 master. **Aceite:** All scenario sums derived from selected candidate intervals; simulated≠realized.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "insightRefs",
    "targetCents"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "insightRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 100
      },
      "minItems": 1,
      "maxItems": 25,
      "uniqueItems": true
    },
    "targetCents": {
      "type": "integer",
      "minimum": 0,
      "maximum": 999999999
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scenarios"
          ],
          "properties": {
            "scenarios": {
              "type": "array",
              "minItems": 1,
              "maxItems": 3,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "name",
                  "saveCents",
                  "goalReached"
                ],
                "properties": {
                  "name": {
                    "type": "string",
                    "enum": [
                      "conservative",
                      "base",
                      "optimistic"
                    ]
                  },
                  "saveCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "goalReached": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scenarios"
          ],
          "properties": {
            "scenarios": {
              "type": "array",
              "minItems": 1,
              "maxItems": 3,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "name",
                  "saveCents",
                  "goalReached"
                ],
                "properties": {
                  "name": {
                    "type": "string",
                    "enum": [
                      "conservative",
                      "base",
                      "optimistic"
                    ]
                  },
                  "saveCents": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "goalReached": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f-master",
  "insightRefs": [
    "cut-delivery",
    "cut-other",
    "review-streamco"
  ],
  "targetCents": 30000
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-master-v1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "cut-delivery",
    "cut-other",
    "review-streamco"
  ],
  "method": "simulate_intervals_non_overlap",
  "data": {
    "scenarios": [
      {
        "name": "conservative",
        "saveCents": 12000,
        "goalReached": false
      },
      {
        "name": "base",
        "saveCents": 15000,
        "goalReached": false
      },
      {
        "name": "optimistic",
        "saveCents": 23000,
        "goalReached": false
      }
    ]
  }
}
```

## 9. build_evidence_answer — Assemble display response from verified facts and optional hypotheses, no new financial calculations

**Reuso:** IC2 facts/visual cards + shared evidence envelope. **Estado:** PROPOSED_NOT_IMPLEMENTED. **Escopo:** MAIN authorizes scopeRef; owner/token never accepted from model; read-only; if planning data, separate planning consent. **Dados stale:** Stop on dataVersion or grant mismatch before/after invocation; no stale answer.

**Erros:** EVIDENCE_NOT_FOUND, STALE, UNCITED_AMOUNT. **Limites/paginação:** ≤50 fact refs, ≤3 next actions, validate every monetary phrase against facts. **Testes:** T-003,T-026,T-040,T-043,T-048. **Aceite:** No uncited monetary assertion, claim of verified personal write, or confusion between result and balance.

**InputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "scopeRef",
    "question",
    "evidenceRefs"
  ],
  "properties": {
    "scopeRef": {
      "type": "string",
      "pattern": "^scope-[a-z0-9-]+$",
      "maxLength": 96
    },
    "question": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    },
    "evidenceRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 100
      },
      "minItems": 1,
      "maxItems": 50,
      "uniqueItems": true
    }
  }
}
```

**OutputSchema (JSON Schema 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data"
      ],
      "properties": {
        "status": {
          "const": "ready"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "headline",
            "factRefs",
            "warning",
            "nextActions"
          ],
          "properties": {
            "headline": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "factRefs": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "uniqueItems": true
            },
            "warning": {
              "type": [
                "string",
                "null"
              ]
            },
            "nextActions": {
              "type": "array",
              "maxItems": 3,
              "items": {
                "type": "string"
              }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "dataVersion",
        "asOf",
        "coverage",
        "source",
        "sourceIds",
        "method",
        "data",
        "warnings"
      ],
      "properties": {
        "status": {
          "const": "partial"
        },
        "dataVersion": {
          "type": "string",
          "minLength": 1
        },
        "asOf": {
          "type": "string",
          "format": "date-time"
        },
        "coverage": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "state",
            "readRows",
            "hasMore"
          ],
          "properties": {
            "state": {
              "type": "string",
              "enum": [
                "complete",
                "partial",
                "unknown"
              ]
            },
            "readRows": {
              "type": "integer",
              "minimum": 0
            },
            "hasMore": {
              "type": "boolean"
            },
            "missingPeriods": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "source": {
          "enum": [
            "bank",
            "manual"
          ],
          "type": "string"
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "method": {
          "type": "string",
          "minLength": 1
        },
        "data": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "headline",
            "factRefs",
            "warning",
            "nextActions"
          ],
          "properties": {
            "headline": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "factRefs": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "uniqueItems": true
            },
            "warning": {
              "type": [
                "string",
                "null"
              ]
            },
            "nextActions": {
              "type": "array",
              "maxItems": 3,
              "items": {
                "type": "string"
              }
            }
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "status",
        "code",
        "message"
      ],
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "denied",
            "stale",
            "no_data",
            "unsupported",
            "error"
          ]
        },
        "code": {
          "type": "string",
          "minLength": 1
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

**Entrada sintética válida**

```json
{
  "scopeRef": "scope-f1-bank",
  "question": "Por que gastei mais em novembro?",
  "evidenceRefs": [
    "fact-month-delta",
    "fact-food-delta",
    "fact-transport-delta",
    "fact-insurance-delta"
  ]
}
```

**Saída sintética esperada**

```json
{
  "status": "ready",
  "dataVersion": "fixture-f1",
  "asOf": "2026-11-30T23:59:00Z",
  "coverage": {
    "state": "complete",
    "readRows": 7,
    "hasMore": false,
    "missingPeriods": []
  },
  "source": "bank",
  "sourceIds": [
    "fact-month-delta",
    "fact-food-delta",
    "fact-transport-delta",
    "fact-insurance-delta"
  ],
  "method": "evidence_only_render",
  "data": {
    "headline": "Despesas aumentaram R$ 50 em novembro; as maiores contribuições foram transporte e seguro.",
    "factRefs": [
      "fact-month-delta",
      "fact-food-delta",
      "fact-transport-delta",
      "fact-insurance-delta"
    ],
    "warning": "Contribuição aritmética não prova causa pessoal.",
    "nextActions": [
      "Ver gastos por estabelecimento",
      "Simular cortes"
    ]
  }
}
```

## Regras comuns de implementação
- Engine de tempo: dataVersion + asOf + coverage sempre presentes; pageCursor vinculado ao escopo e versão, nunca passado sem validação.
- Status != ready não pode ser tratado como total consolidado; partial requer ressalva e, para metas, intervalo de confiança explícito.
- Persistência de insights não é persistência de transação. Nenhuma ferramenta deste MVP altera dados.
- Métricas de custo/latência: medir chamadas reais no QA futuro (p50/p95, tokens e erros) — não inventar números. Estimativa qualitativa: read local baixo; multi-período/recorrência médio; resposta com LLM opcional caro/variável.
- Autorização de leitura não é autorização de planejamento; read_commitments exige grant planning.
- Para cada ferramenta escrever casos de teste de path feliz, sem dados, denied, stale, partial, input inválido e regressão específica. Usar fixtures sintéticas e status NOT_RUN até execução.
- Falta de implementação não deve ser mascarada por uma resposta “ok” genérica; o adaptador futuro retorna unsupported com motivo até estar conectado.
