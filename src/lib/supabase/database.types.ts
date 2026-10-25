
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "obx_auditoria": {
                  Row: {
                    "acao": string,"created_at": string,"dados_antigos": Json | null,"dados_novos": Json | null,"empresa_id": string,"id": number,"registro_id": string,"tabela": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"created_at"?: string,"dados_antigos"?: Json | null,"dados_novos"?: Json | null,"empresa_id": string,"id"?: never,"registro_id": string,"tabela": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"created_at"?: string,"dados_antigos"?: Json | null,"dados_novos"?: Json | null,"empresa_id"?: string,"id"?: never,"registro_id"?: string,"tabela"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [

                  ]
                },"obx_centros_custo": {
                  Row: {
                    "codigo": string,"created_at": string,"empresa_id": string,"id": string,"nome": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"created_at"?: string,"empresa_id": string,"id"?: string,"nome": string,"updated_at"?: string
                  }
                  Update: {
                    "codigo"?: string,"created_at"?: string,"empresa_id"?: string,"id"?: string,"nome"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_centros_custo_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "obx_empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_custos": {
                  Row: {
                    "categoria": Database["public"]['Enums']["obx_custo_categoria"],"centro_custo_id": string | null,"created_at": string,"criado_por": string,"data": string,"descricao": string,"documento": string | null,"eap_item_id": string | null,"fornecedor": string | null,"id": string,"obra_id": string,"updated_at": string,"valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria": Database["public"]['Enums']["obx_custo_categoria"],"centro_custo_id"?: string | null,"created_at"?: string,"criado_por": string,"data": string,"descricao": string,"documento"?: string | null,"eap_item_id"?: string | null,"fornecedor"?: string | null,"id"?: string,"obra_id": string,"updated_at"?: string,"valor": number
                  }
                  Update: {
                    "categoria"?: Database["public"]['Enums']["obx_custo_categoria"],"centro_custo_id"?: string | null,"created_at"?: string,"criado_por"?: string,"data"?: string,"descricao"?: string,"documento"?: string | null,"eap_item_id"?: string | null,"fornecedor"?: string | null,"id"?: string,"obra_id"?: string,"updated_at"?: string,"valor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_custos_centro_custo_id_fkey"
      columns: ["centro_custo_id"]
isOneToOne: false
      referencedRelation: "obx_centros_custo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_custos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_custos_eap_item_id_fkey"
      columns: ["eap_item_id"]
isOneToOne: false
      referencedRelation: "obx_eap_itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_custos_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_obras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_custos_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_vw_obra_resumo"
      referencedColumns: ["obra_id"]
    }
                  ]
                },"obx_eap_itens": {
                  Row: {
                    "centro_custo_id": string | null,"codigo": string,"created_at": string,"custo_total": number | null,"custo_unitario": number,"descricao": string,"id": string,"obra_id": string,"ordem": number,"parent_id": string | null,"quantidade": number,"tipo": Database["public"]['Enums']["obx_eap_tipo"],"unidade": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "centro_custo_id"?: string | null,"codigo": string,"created_at"?: string,"custo_total"?: never,"custo_unitario"?: number,"descricao": string,"id"?: string,"obra_id": string,"ordem"?: number,"parent_id"?: string | null,"quantidade"?: number,"tipo": Database["public"]['Enums']["obx_eap_tipo"],"unidade"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "centro_custo_id"?: string | null,"codigo"?: string,"created_at"?: string,"custo_total"?: never,"custo_unitario"?: number,"descricao"?: string,"id"?: string,"obra_id"?: string,"ordem"?: number,"parent_id"?: string | null,"quantidade"?: number,"tipo"?: Database["public"]['Enums']["obx_eap_tipo"],"unidade"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_eap_itens_centro_custo_id_fkey"
      columns: ["centro_custo_id"]
isOneToOne: false
      referencedRelation: "obx_centros_custo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_eap_itens_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_obras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_eap_itens_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_vw_obra_resumo"
      referencedColumns: ["obra_id"]
    },{
      foreignKeyName: "obx_eap_itens_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "obx_eap_itens"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_empresa_membros": {
                  Row: {
                    "created_at": string,"empresa_id": string,"perfil": Database["public"]['Enums']["obx_perfil"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"empresa_id": string,"perfil": Database["public"]['Enums']["obx_perfil"],"usuario_id": string
                  }
                  Update: {
                    "created_at"?: string,"empresa_id"?: string,"perfil"?: Database["public"]['Enums']["obx_perfil"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_empresa_membros_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "obx_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_empresa_membros_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_empresas": {
                  Row: {
                    "cnpj": string | null,"created_at": string,"fuso_horario": string,"id": string,"locale": string,"moeda": string,"nome": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cnpj"?: string | null,"created_at"?: string,"fuso_horario"?: string,"id"?: string,"locale"?: string,"moeda"?: string,"nome": string,"updated_at"?: string
                  }
                  Update: {
                    "cnpj"?: string | null,"created_at"?: string,"fuso_horario"?: string,"id"?: string,"locale"?: string,"moeda"?: string,"nome"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"obx_fotos": {
                  Row: {
                    "created_at": string,"criado_por": string,"eap_item_id": string | null,"id": string,"legenda": string | null,"obra_id": string,"rdo_id": string | null,"storage_path": string,"tirada_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criado_por": string,"eap_item_id"?: string | null,"id"?: string,"legenda"?: string | null,"obra_id": string,"rdo_id"?: string | null,"storage_path": string,"tirada_em"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"criado_por"?: string,"eap_item_id"?: string | null,"id"?: string,"legenda"?: string | null,"obra_id"?: string,"rdo_id"?: string | null,"storage_path"?: string,"tirada_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_fotos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_fotos_eap_item_id_fkey"
      columns: ["eap_item_id"]
isOneToOne: false
      referencedRelation: "obx_eap_itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_fotos_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_obras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_fotos_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_vw_obra_resumo"
      referencedColumns: ["obra_id"]
    },{
      foreignKeyName: "obx_fotos_rdo_id_fkey"
      columns: ["rdo_id"]
isOneToOne: false
      referencedRelation: "obx_rdos"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_obra_membros": {
                  Row: {
                    "created_at": string,"obra_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"obra_id": string,"usuario_id": string
                  }
                  Update: {
                    "created_at"?: string,"obra_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_obra_membros_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_obras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_obra_membros_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_vw_obra_resumo"
      referencedColumns: ["obra_id"]
    },{
      foreignKeyName: "obx_obra_membros_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_obras": {
                  Row: {
                    "cidade": string | null,"cliente": string | null,"codigo": string,"created_at": string,"data_fim_prevista": string | null,"data_inicio": string | null,"empresa_id": string,"endereco": string | null,"id": string,"nome": string,"responsavel_id": string | null,"status": Database["public"]['Enums']["obx_obra_status"],"uf": string | null,"updated_at": string,"valor_contrato": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cidade"?: string | null,"cliente"?: string | null,"codigo": string,"created_at"?: string,"data_fim_prevista"?: string | null,"data_inicio"?: string | null,"empresa_id": string,"endereco"?: string | null,"id"?: string,"nome": string,"responsavel_id"?: string | null,"status"?: Database["public"]['Enums']["obx_obra_status"],"uf"?: string | null,"updated_at"?: string,"valor_contrato"?: number | null
                  }
                  Update: {
                    "cidade"?: string | null,"cliente"?: string | null,"codigo"?: string,"created_at"?: string,"data_fim_prevista"?: string | null,"data_inicio"?: string | null,"empresa_id"?: string,"endereco"?: string | null,"id"?: string,"nome"?: string,"responsavel_id"?: string | null,"status"?: Database["public"]['Enums']["obx_obra_status"],"uf"?: string | null,"updated_at"?: string,"valor_contrato"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_obras_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "obx_empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_obras_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_rdo_equipamentos": {
                  Row: {
                    "created_at": string,"equipamento": string,"horas_paradas": number,"horas_trabalhadas": number,"id": string,"motivo_parada": string | null,"rdo_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"equipamento": string,"horas_paradas"?: number,"horas_trabalhadas"?: number,"id"?: string,"motivo_parada"?: string | null,"rdo_id": string
                  }
                  Update: {
                    "created_at"?: string,"equipamento"?: string,"horas_paradas"?: number,"horas_trabalhadas"?: number,"id"?: string,"motivo_parada"?: string | null,"rdo_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_rdo_equipamentos_rdo_id_fkey"
      columns: ["rdo_id"]
isOneToOne: false
      referencedRelation: "obx_rdos"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_rdo_mao_obra": {
                  Row: {
                    "created_at": string,"funcao": string,"horas": number,"id": string,"quantidade": number,"rdo_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"funcao": string,"horas"?: number,"id"?: string,"quantidade"?: number,"rdo_id": string
                  }
                  Update: {
                    "created_at"?: string,"funcao"?: string,"horas"?: number,"id"?: string,"quantidade"?: number,"rdo_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_rdo_mao_obra_rdo_id_fkey"
      columns: ["rdo_id"]
isOneToOne: false
      referencedRelation: "obx_rdos"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_rdo_materiais": {
                  Row: {
                    "created_at": string,"id": string,"material": string,"quantidade": number,"rdo_id": string,"unidade": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"material": string,"quantidade": number,"rdo_id": string,"unidade": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"material"?: string,"quantidade"?: number,"rdo_id"?: string,"unidade"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_rdo_materiais_rdo_id_fkey"
      columns: ["rdo_id"]
isOneToOne: false
      referencedRelation: "obx_rdos"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_rdo_ocorrencias": {
                  Row: {
                    "created_at": string,"descricao": string,"hora_fim": string | null,"hora_inicio": string | null,"id": string,"rdo_id": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"descricao": string,"hora_fim"?: string | null,"hora_inicio"?: string | null,"id"?: string,"rdo_id": string,"tipo": string
                  }
                  Update: {
                    "created_at"?: string,"descricao"?: string,"hora_fim"?: string | null,"hora_inicio"?: string | null,"id"?: string,"rdo_id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_rdo_ocorrencias_rdo_id_fkey"
      columns: ["rdo_id"]
isOneToOne: false
      referencedRelation: "obx_rdos"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_rdo_producao": {
                  Row: {
                    "created_at": string,"eap_item_id": string,"id": string,"observacao": string | null,"quantidade": number,"rdo_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"eap_item_id": string,"id"?: string,"observacao"?: string | null,"quantidade": number,"rdo_id": string
                  }
                  Update: {
                    "created_at"?: string,"eap_item_id"?: string,"id"?: string,"observacao"?: string | null,"quantidade"?: number,"rdo_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_rdo_producao_eap_item_id_fkey"
      columns: ["eap_item_id"]
isOneToOne: false
      referencedRelation: "obx_eap_itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_rdo_producao_rdo_id_fkey"
      columns: ["rdo_id"]
isOneToOne: false
      referencedRelation: "obx_rdos"
      referencedColumns: ["id"]
    }
                  ]
                },"obx_rdos": {
                  Row: {
                    "clima_manha": Database["public"]['Enums']["obx_clima"] | null,"clima_tarde": Database["public"]['Enums']["obx_clima"] | null,"confirmado_em": string | null,"confirmado_por": string | null,"created_at": string,"criado_por": string,"data": string,"id": string,"obra_id": string,"observacoes": string | null,"status": Database["public"]['Enums']["obx_rdo_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clima_manha"?: Database["public"]['Enums']["obx_clima"] | null,"clima_tarde"?: Database["public"]['Enums']["obx_clima"] | null,"confirmado_em"?: string | null,"confirmado_por"?: string | null,"created_at"?: string,"criado_por": string,"data": string,"id"?: string,"obra_id": string,"observacoes"?: string | null,"status"?: Database["public"]['Enums']["obx_rdo_status"],"updated_at"?: string
                  }
                  Update: {
                    "clima_manha"?: Database["public"]['Enums']["obx_clima"] | null,"clima_tarde"?: Database["public"]['Enums']["obx_clima"] | null,"confirmado_em"?: string | null,"confirmado_por"?: string | null,"created_at"?: string,"criado_por"?: string,"data"?: string,"id"?: string,"obra_id"?: string,"observacoes"?: string | null,"status"?: Database["public"]['Enums']["obx_rdo_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "obx_rdos_confirmado_por_fkey"
      columns: ["confirmado_por"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_rdos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "obx_usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_rdos_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_obras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "obx_rdos_obra_id_fkey"
      columns: ["obra_id"]
isOneToOne: false
      referencedRelation: "obx_vw_obra_resumo"
      referencedColumns: ["obra_id"]
    }
                  ]
                },"obx_usuarios": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"nome": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id": string,"nome": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"nome"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            "obx_vw_obra_resumo": {
                  Row: {
                    "avanco_fisico_pct": number | null,"avanco_planejado_pct": number | null,"custo_realizado": number | null,"obra_id": string,"orcado_total": number | null,"valor_executado": number | null
                  }
                  ComputedFields: never
                  Relationships: [

                  ]
                }
          }
          Functions: {
            "obx_fn_criar_empresa":
{ Args: { "p_cnpj"?: string,"p_nome": string }; Returns: string
                           },
"obx_fn_importar_custos":
{ Args: { "p_itens": Json,"p_obra_id": string }; Returns: Json
                           },
"obx_fn_importar_eap":
{ Args: { "p_itens": Json,"p_modo": string,"p_obra_id": string }; Returns: Json
                           },
"obx_fn_perfil_na_empresa":
{ Args: { "p_empresa_id": string }; Returns: Database["public"]['Enums']["obx_perfil"]
                           },
"obx_fn_pode_editar_custo":
{ Args: { "p_obra_id": string }; Returns: boolean
                           },
"obx_fn_pode_editar_obra":
{ Args: { "p_obra_id": string }; Returns: boolean
                           },
"obx_fn_pode_editar_rdo":
{ Args: { "p_rdo_id": string }; Returns: boolean
                           },
"obx_fn_pode_registrar_campo":
{ Args: { "p_obra_id": string }; Returns: boolean
                           },
"obx_fn_pode_ver_custo":
{ Args: { "p_obra_id": string }; Returns: boolean
                           },
"obx_fn_pode_ver_obra":
{ Args: { "p_obra_id": string }; Returns: boolean
                           },
"obx_fn_salvar_rdo":
{ Args: { "p_data": string,"p_obra_id": string,"p_payload": Json }; Returns: string
                           },
"obx_fn_usuario_na_empresa":
{ Args: { "p_empresa_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "obx_clima": "bom"|"nublado"|"chuva_fraca"|"chuva_forte"|"impraticavel","obx_custo_categoria": "mao_obra"|"material"|"equipamento"|"servico_terceiro"|"indireto","obx_eap_tipo": "etapa"|"servico","obx_obra_status": "planejamento"|"em_andamento"|"paralisada"|"concluida","obx_perfil": "diretor"|"engenheiro"|"encarregado"|"financeiro","obx_rdo_status": "rascunho"|"confirmado"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "obx_clima": ["bom", "nublado", "chuva_fraca", "chuva_forte", "impraticavel"],"obx_custo_categoria": ["mao_obra", "material", "equipamento", "servico_terceiro", "indireto"],"obx_eap_tipo": ["etapa", "servico"],"obx_obra_status": ["planejamento", "em_andamento", "paralisada", "concluida"],"obx_perfil": ["diretor", "engenheiro", "encarregado", "financeiro"],"obx_rdo_status": ["rascunho", "confirmado"]
          }
        }
} as const
