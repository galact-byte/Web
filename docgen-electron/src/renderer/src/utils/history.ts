export interface SystemItem {
  系统名称: string
  系统级别: string
}

export interface ProjectData {
  项目编号: string
  项目名称: string
  单位名称: string
  委托单位联系人: string
  委托单位联系方式: string
  验证测试方式?: '执行验证测试' | '自愿放弃验证测试'
  具体业务名称: string
  业务影响: string
  影响后果: string
  系统: SystemItem[]
  deletedAt?: string
}

export interface SingleHistoryEntry {
  mode?: 'single'
  timestamp: string
  data: ProjectData
}

export interface MultiHistoryEntry {
  mode?: 'multi'
  timestamp: string
  data: {
    projects: ProjectData[]
  }
}

export const isMultiHistoryEntry = (item: any): item is MultiHistoryEntry => {
  return Boolean(item && (item.mode === 'multi' || Array.isArray(item?.data?.projects)))
}

export const isSingleHistoryEntry = (item: any): item is SingleHistoryEntry => {
  return Boolean(
    item &&
      !isMultiHistoryEntry(item) &&
      item.data &&
      typeof item.data['项目名称'] === 'string' &&
      item.data['项目名称'].trim().length > 0
  )
}

export const fetchSplitHistory = async (): Promise<{
  single: SingleHistoryEntry[]
  multi: MultiHistoryEntry[]
}> => {
  const raw = (await window.api.getHistory()) || []
  const list = Array.isArray(raw) ? raw : []
  return {
    single: list.filter(isSingleHistoryEntry),
    multi: list.filter(isMultiHistoryEntry)
  }
}

export const saveSingleHistoryList = async (
  singleList: SingleHistoryEntry[]
): Promise<boolean> => {
  const { multi } = await fetchSplitHistory()
  const plainSingle = JSON.parse(
    JSON.stringify(
      singleList.map((item) => ({
        mode: 'single',
        timestamp: item.timestamp,
        data: item.data
      }))
    )
  )
  const plainMulti = JSON.parse(JSON.stringify(multi))
  return window.api.saveFile('history.json', [...plainSingle, ...plainMulti])
}

export const saveMultiHistoryList = async (
  multiList: MultiHistoryEntry[]
): Promise<boolean> => {
  const { single } = await fetchSplitHistory()
  const plainMulti = JSON.parse(
    JSON.stringify(
      multiList.map((item) => ({
        mode: 'multi',
        timestamp: item.timestamp,
        data: item.data
      }))
    )
  )
  const plainSingle = JSON.parse(JSON.stringify(single))
  return window.api.saveFile('history.json', [...plainSingle, ...plainMulti])
}
