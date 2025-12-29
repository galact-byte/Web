#!/usr/bin/env python
# -*- coding:utf-8 -*-
# author:qiao xiong
# datetime:2025/3/13 17:52
# name: 01
#!/usr/bin/env python
# -*- coding:utf-8 -*-
# author:qiao xiong
# datetime:2025/3/13 17:21
# name: demo-csdn


# {
#     "文档名称": "20测评环境恢复确认表.docx",
#     "文档替换规则": [
#       ["项目编号",0,0,1],
# 		["项目名称",0,1,1],
# 		["合并系统信息",0,2,1]
#     ]
# }

# 第一个数字是指第几表格
# 第二个数字表示。第几行
# 第三个数字表示第几列。

from docx import Document

docPath = '20测评环境恢复确认表.docx'
doc = Document(docPath)

table = doc.tables[0]

# 遍历表格每一行，并打印每个单元格的内容
for i,row in enumerate(table.rows):
    for j, cell in enumerate(row.cells):
        print(i,j,cell.text)