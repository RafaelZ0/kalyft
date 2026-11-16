# Converte a planilha oficial do IBGE (POF 2008-2009, Tabelas de Composição Nutricional dos Alimentos Consumidos
# no Brasil, "tabelacompleta.xls") num CSV fiel (UTF-8, separador ";"), só com as colunas usadas pelo Kalyft.
# Transcrição sem alterar valores: números como estão na planilha (até 6 casas), "-" mantido (= zero na convenção
# da publicação). Roda uma vez, fora do app. Requer: Python 3 e xlrd 2.0.1 (pip install xlrd==2.0.1).
#
# Uso: python -I scripts/converter-ibge-pof.py caminho/tabelacompleta.xls dados/ibge-pof/composicao.csv
import csv, sys, xlrd

COLUNAS = {
    "codigo_alimento": 0, "descricao": 1, "codigo_preparo": 2, "preparo": 3, "ref_codigo": 4, "ref_descricao": 5,
    "kcal": 6, "proteina_g": 7, "gordura_g": 8, "carbo_g": 9, "fibra_g": 10, "sodio_mg": 16, "sodio_adicao_mg": 17,
}
CABECALHO_ESPERADO = {0: "CÓDIGO DO ALIMENTO", 1: "DESCRIÇÃO DO ALIMENTO", 4: "REFE", 6: "ENERGIA (kcal)", 7: "PROTEÍNA (g)",
                      8: "LIPÍDEOS TOTAIS (g)", 9: "CARBOIDRATO (g)", 10: "FIBRA ALIMENTAR TOTAL (g)", 16: "SÓDIO (mg)",
                      17: "SÓDIO DE ADIÇÃO (mg)"}

def texto(v):
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f"{v:.6f}".rstrip("0").rstrip(".")
    return " ".join(str(v).split())

sh = xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
cab = [str(c.value).strip() for c in sh.row(3)]
for i, esperado in CABECALHO_ESPERADO.items():
    if not cab[i].upper().startswith(esperado.upper()):
        sys.exit(f"coluna {i} inesperada: {cab[i]!r} (esperado {esperado!r})")
with open(sys.argv[2], "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, delimiter=";", lineterminator="\n")
    w.writerow(list(COLUNAS))
    n = 0
    for r in range(4, sh.nrows):
        if not isinstance(sh.cell_value(r, 0), float):
            continue
        w.writerow([texto(sh.cell_value(r, i)) for i in COLUNAS.values()])
        n += 1
print("linhas:", n)
