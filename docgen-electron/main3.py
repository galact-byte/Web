#!/usr/bin/env python
# -*- coding:utf-8 -*-
# author:qiao xiong
# datetime:2025/3/13 20:31
# name: main
import sys
import platform
if platform.system() == 'Windows':
    sys.stdout.reconfigure(encoding="gbk")
    sys.stderr.reconfigure(encoding="gbk")
else:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from docx import Document
import json
from copy import deepcopy
import os


def copy_cell_00_format(table, dest_row, dest_col):
    """
    将表格中 (1,0) 位置的单元格全部格式复制到指定目标单元格（dest_row, dest_col）。
    注意：这将清除目标单元格原有内容。

    参数:
        table: 表格对象（Table）
        dest_row: 目标单元格所在的行索引（从 0 开始）
        dest_col: 目标单元格所在的列索引（从 0 开始）

    返回:
        复制格式后的目标单元格对象
    """
    src_cell = table.rows[1].cells[0]
    dest_cell = table.rows[dest_row].cells[dest_col]

    # 清除目标单元格原有内容
    dest_cell._tc.clear_content()

    # 复制源单元格的所有 XML 元素（格式、样式等）到目标单元格
    for element in src_cell._tc:
        dest_cell._tc.append(deepcopy(element))

    return dest_cell


def merge_system_information(project_info):
    """合并系统信息"""
    merge_info = project_info['系统']
    systems = [f"{system_info['系统名称']}（{system_info['系统级别']}）" for system_info in merge_info]
    project_info['合并系统信息'] = '、'.join(systems)
    return project_info


def auto_add_project_info(project_info):
    """自动添加项目信息的默认值"""
    project_info = merge_system_information(project_info)

    # 如果用户没有填写"业务影响"，则使用默认值
    if '业务影响' not in project_info or not project_info['业务影响']:
        project_info['业务影响'] = '中断、停机等'

    # 如果用户没有填写"影响后果"，则使用默认值
    if '影响后果' not in project_info or not project_info['影响后果']:
        project_info['影响后果'] = '业务中断、服务器宕机等情况'

    # 用于清空某些字段
    project_info['取空'] = ""

    return project_info


def replace_doc_content(rules, project_info, output_subdir=None):
    """
    替换文档中的固定内容并保存
    :param rules: 替换规则(包含模板文档名称和替换规则)
    :param project_info: 项目信息
    :param output_subdir: 输出子目录名称（用于多项目时区分不同项目）
    :return: None
    """
    doc = Document("templates\\" + rules['文档名称'])

    for rule in rules['文档替换规则']:
        if len(rule) != 3:
            # 表格替换
            table = doc.tables[rule[1]]
            dest_cell = copy_cell_00_format(table, dest_row=rule[2], dest_col=rule[3])

            if dest_cell.paragraphs:
                for paragraph in dest_cell.paragraphs:
                    all_text = "".join(run.text for run in paragraph.runs)

                    # 替换文本
                    if all_text:
                        new_runs = paragraph.runs
                        new_runs[0].text = project_info[rule[0]]
                        for run in new_runs[1:]:
                            run.text = ""
        else:
            # 段落替换
            doc.paragraphs[rule[1]].runs[rule[2]].text = project_info[rule[0]]

    # 保存新文档
    output_dir = '授权文档输出目录'

    # 如果指定了子目录，则在输出目录下创建子目录
    if output_subdir:
        output_dir = os.path.join(output_dir, output_subdir)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    output_filename = os.path.splitext(rules['文档名称'])[0] + ".docx"
    output_path = os.path.join(output_dir, output_filename)
    doc.save(output_path)
    print(f"已生成文档: {output_path}")


def process_single_project(project_info, rules_dir):
    """处理单个项目的文档生成"""
    project_info = auto_add_project_info(project_info)

    # 遍历rules文件夹下的所有json规则文件
    for rule_file in os.listdir(rules_dir):
        if rule_file.endswith('.json'):
            # 读取规则文件
            with open(os.path.join(rules_dir, rule_file), 'r', encoding='utf-8') as f:
                config = json.load(f)
            # 替换文档内容并保存
            replace_doc_content(config, project_info)


def process_multiple_projects(projects_data, rules_dir):
    """处理多个项目的批量文档生成"""
    for idx, project_info in enumerate(projects_data['projects'], start=1):
        print(f"\n正在处理第 {idx} 个项目: {project_info['项目名称']}")
        project_info = auto_add_project_info(project_info)

        # 使用项目编号作为子目录名称
        output_subdir = f"{project_info['项目编号']}_{project_info['项目名称']}"

        # 遍历rules文件夹下的所有json规则文件
        for rule_file in os.listdir(rules_dir):
            if rule_file.endswith('.json'):
                # 读取规则文件
                with open(os.path.join(rules_dir, rule_file), 'r', encoding='utf-8') as f:
                    config = json.load(f)
                # 替换文档内容并保存到对应项目的子目录
                replace_doc_content(config, project_info, output_subdir)


import argparse
import sys

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DocGen Pro Automation')
    parser.add_argument('--mode', type=str, choices=['1', '2'], help='Mode: 1 for Single Project, 2 for Multi Project')
    parser.add_argument('--config', type=str, help='Path to configuration JSON file (information.json or projects.json)')
    parser.add_argument('--rules', type=str, default='rules', help='Path to rules directory')
    
    # If no arguments provided, fall back to interactive mode (compatibility)
    if len(sys.argv) == 1:
        print("=" * 60)
        print("文档自动生成工具")
        print("=" * 60)
        print("\n请选择生成模式：")
        print("1. 单项目模式 (使用 information.json)")
        print("2. 多项目批量模式 (使用 projects.json)")
        print("=" * 60)

        mode = input("\n请输入模式编号 (1 或 2): ").strip()
        rules_dir = 'rules'
        
        if mode == '1':
            config_file = 'information.json'
        elif mode == '2':
            config_file = 'projects.json'
        else:
            print("无效的选择！请输入 1 或 2")
            exit(1)
    else:
        args = parser.parse_args()
        mode = args.mode
        config_file = args.config
        rules_dir = args.rules

    if mode == '1':
        # 单项目模式
        print(f"\n正在运行单项目模式... 配置文件: {config_file}")
        if not os.path.exists(config_file):
            print(f"错误: 找不到配置文件 {config_file}")
            exit(1)

        with open(config_file, 'r', encoding='utf-8') as f:
            project_info = json.load(f)

        process_single_project(project_info, rules_dir)
        print("\n单项目文档生成完成！")

    elif mode == '2':
        # 多项目批量模式
        print(f"\n正在运行多项目批量模式... 配置文件: {config_file}")
        if not os.path.exists(config_file):
            print(f"错误: 找不到配置文件 {config_file}")
            exit(1)

        with open(config_file, 'r', encoding='utf-8') as f:
            projects_data = json.load(f)

        if 'projects' not in projects_data or len(projects_data['projects']) == 0:
            print("错误: projects.json 中没有项目数据！")
            exit(1)

        print(f"共找到 {len(projects_data['projects'])} 个项目")
        process_multiple_projects(projects_data, rules_dir)
        print("\n多项目批量文档生成完成！")
    
    print("\n所有文档已生成到 '授权文档输出目录' 文件夹中")
