// 数据结构
// {
//   folders: {
//     "folder_id": { 
//       id: "folder_id", 
//       name: "文件夹名称", 
//       parent: "parent_folder_id",
//       icon: "fas fa-folder", // 预设图标
//       iconType: "preset", // 图标类型: preset(预设) 或 custom(自定义)
//       customIcon: "data:image/..." // Base64编码的图标数据或URL
//     }
//   },
//   tools: {
//     "tool_id": { 
//       id: "tool_id", 
//       name: "工具名称", 
//       url: "https://example.com", 
//       icon: "icon_url", 
//       folderId: "folder_id"
//     }
//   }
// }

document.addEventListener('DOMContentLoaded', function() {
  // 全局变量
  let currentFolderId = 'root';
  let selectedItem = null;
  let editingItemId = null;
  let draggedItem = null;
  let breadcrumbPath = [{ id: 'root', name: '主页' }];
  
  // 获取DOM元素
  const toolsList = document.getElementById('toolsList');
  const breadcrumb = document.getElementById('breadcrumb');
  const contextMenu = document.getElementById('contextMenu');
  const addCurrentPageBtn = document.getElementById('addCurrentPageBtn');
  const openInTabBtn = document.getElementById('openInTabBtn');
  
  // 工具模态框元素
  const toolModal = document.getElementById('toolModal');
  const closeModal = document.getElementById('closeModal');
  const modalTitle = document.getElementById('modalTitle');
  const toolNameInput = document.getElementById('toolName');
  const toolUrlInput = document.getElementById('toolUrl');
  const toolIconInput = document.getElementById('toolIcon');
  const toolIconPreview = document.getElementById('toolIconPreview');
  const fetchInfoBtn = document.getElementById('fetchInfoBtn');
  const folderSelect = document.getElementById('folderSelect');
  const saveToolBtn = document.getElementById('saveToolBtn');
  const cancelToolBtn = document.getElementById('cancelToolBtn');
  
  // 文件夹模态框元素
  const folderModal = document.getElementById('folderModal');
  const closeFolderModal = document.getElementById('closeFolderModal');
  const folderModalTitle = document.getElementById('folderModalTitle');
  const folderNameInput = document.getElementById('folderName');
  const folderIconClass = document.getElementById('folderIconClass');
  const folderIconType = document.getElementById('folderIconType');
  const folderIconData = document.getElementById('folderIconData');
  const folderIconPreview = document.getElementById('folderIconPreview');
  const folderIconUrl = document.getElementById('folderIconUrl');
  const folderIconFile = document.getElementById('folderIconFile');
  const saveFolderBtn = document.getElementById('saveFolderBtn');
  const cancelFolderBtn = document.getElementById('cancelFolderBtn');
  const iconOptions = document.querySelectorAll('.icon-option');
  const iconTabs = document.querySelectorAll('.icon-tab');
  
  // 初始化
  init();
  
  // 初始化函数
  function init() {
    // 尝试最大化弹出窗口
    maximizePopup();
    
    // 检查是否是在选项页中打开的
    const isOptionsPage = window.location.href.includes('chrome-extension://') && 
                          window.location.href.includes('popup.html') && 
                          !window.location.href.includes('popup=true');
    
    // 如果是在选项页中打开的，隐藏"在新标签页中打开"按钮
    if (isOptionsPage && openInTabBtn) {
      openInTabBtn.style.display = 'none';
    }
    
    // 加载并渲染数据
    loadData().then(data => {
      renderCurrentFolder(data);
      updateBreadcrumb();
      
      // 同步访问历史
      syncAccessHistory();
    });
    
    // 设置拖拽事件
    setupDragEvents();
    
    // 添加事件监听器
    addCurrentPageBtn.addEventListener('click', showAddToolModal);
    
    // 在新标签页中打开按钮
    if (openInTabBtn) {
      openInTabBtn.addEventListener('click', openInNewTab);
    }
    
    closeModal.addEventListener('click', () => hideModal(toolModal));
    cancelToolBtn.addEventListener('click', () => hideModal(toolModal));
    saveToolBtn.addEventListener('click', saveToolChanges);
    
    closeFolderModal.addEventListener('click', () => hideModal(folderModal));
    cancelFolderBtn.addEventListener('click', () => hideModal(folderModal));
    saveFolderBtn.addEventListener('click', saveFolderChanges);
    
    // 获取网页信息按钮
    fetchInfoBtn.addEventListener('click', fetchWebpageInfo);
    
    // 工具图标URL变化时更新预览
    toolIconInput.addEventListener('input', updateToolIconPreview);
    
    // 文件夹图标URL变化时更新预览
    folderIconUrl.addEventListener('input', updateFolderIconPreview);
    
    // 文件夹图标文件上传
    folderIconFile.addEventListener('change', handleFolderIconUpload);
    
    // 图标标签页切换
    iconTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // 移除所有标签页的active类
        iconTabs.forEach(t => t.classList.remove('active'));
        // 添加当前标签页的active类
        this.classList.add('active');
        
        // 隐藏所有内容
        document.querySelectorAll('.icon-tab-content').forEach(content => {
          content.style.display = 'none';
        });
        
        // 显示当前内容
        const tabId = this.dataset.tab;
        document.getElementById(tabId + 'IconTab').style.display = 'block';
        
        // 更新图标类型
        folderIconType.value = tabId;
        
        // 如果切换到预设图标，重置自定义图标
        if (tabId === 'preset') {
          folderIconData.value = '';
          updateSelectedPresetIcon('fas fa-folder');
        }
      });
    });
    
    // 图标选择器事件
    iconOptions.forEach(option => {
      option.addEventListener('click', function() {
        updateSelectedPresetIcon(this.dataset.icon);
      });
    });
    
    // 点击空白处关闭右键菜单
    document.addEventListener('click', function(e) {
      contextMenu.style.display = 'none';
      
      // 取消选中状态
      if (selectedItem && !e.target.closest('.tool') && !e.target.closest('.folder')) {
        selectedItem.classList.remove('selected');
        selectedItem = null;
      }
    });
    
    // 阻止默认右键菜单
    document.addEventListener('contextmenu', function(e) {
      if (e.target.closest('.tool') || e.target.closest('.folder') || e.target.closest('#toolsList')) {
        e.preventDefault();
      }
    });
    
    // 桌面区域右键菜单
    toolsList.addEventListener('contextmenu', function(e) {
      if (!e.target.closest('.tool') && !e.target.closest('.folder')) {
        showDesktopContextMenu(e);
      }
    });
  }
  
  // 在新标签页中打开扩展
  function openInNewTab() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    });
    
    // 关闭当前弹出窗口
    window.close();
  }
  
  // 尝试最大化弹出窗口
  function maximizePopup() {
    // 设置容器大小以适应屏幕
    const container = document.querySelector('.container');
    if (container) {
      container.style.width = '800px';
      container.style.height = '600px';
    }
    
    // 检查是否是在选项页中打开的
    const isOptionsPage = window.location.href.includes('chrome-extension://') && 
                          window.location.href.includes('popup.html') && 
                          !window.location.href.includes('popup=true');
    
    // 如果是在选项页中打开的，使用更大的尺寸
    if (isOptionsPage && container) {
      container.style.width = '800px';
      container.style.height = '100vh';
      container.style.borderRadius = '0';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    
    // 监听窗口大小变化，动态调整容器大小
    window.addEventListener('resize', function() {
      if (container) {
        if (isOptionsPage) {
          // 如果是在选项页中，填满整个窗口
          container.style.width = '800px';
          container.style.height = '100vh';
        } else {
          // 否则使用预设的大小
          container.style.width = Math.max(800, window.innerWidth - 40) + 'px';
          container.style.height = Math.max(600, window.innerHeight - 40) + 'px';
        }
      }
    });
    
    // 触发一次resize事件
    window.dispatchEvent(new Event('resize'));
  }
  
  // 加载数据
  async function loadData() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['folders', 'tools'], function(result) {
        const data = {
          folders: result.folders || {},
          tools: result.tools || {}
        };
        resolve(data);
      });
    });
  }
  
  // 保存数据
  function saveData(data) {
    return new Promise((resolve, reject) => {
      // 检查数据大小
      const dataSize = JSON.stringify(data).length;
      const maxSize = 100 * 1024; // Chrome同步存储限制为100KB
      
      if (dataSize > maxSize * 0.9) {
        // 数据接近限制，提示用户
        showNotification(`数据存储接近限制 (${Math.round(dataSize/1024)}KB/${Math.round(maxSize/1024)}KB)`, 'error');
        
        // 如果已经超过限制，尝试压缩数据
        if (dataSize > maxSize) {
          const compressedData = compressData(data);
          if (JSON.stringify(compressedData).length <= maxSize) {
            chrome.storage.sync.set(compressedData, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                showNotification('数据已压缩以适应存储限制', 'info');
                resolve();
              }
            });
            return;
          } else {
            reject(new Error('数据超出存储限制，无法保存'));
            return;
          }
        }
      }
      
      // 正常保存数据
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  // 压缩数据以适应存储限制
  function compressData(data) {
    const compressedData = {
      folders: {...data.folders},
      tools: {...data.tools}
    };
    
    // 1. 压缩自定义图标数据
    Object.values(compressedData.folders).forEach(folder => {
      if (folder.iconType === 'custom' && folder.customIcon) {
        // 如果是Base64图标，尝试压缩
        if (folder.customIcon.startsWith('data:image')) {
          folder.customIcon = compressBase64Image(folder.customIcon);
        }
      }
    });
    
    // 2. 如果还是太大，移除一些不常用的工具
    if (JSON.stringify(compressedData).length > 100 * 1024) {
      // 按最后访问时间排序，保留最近使用的工具
      const tools = Object.values(compressedData.tools)
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      
      // 移除最不常用的工具，直到数据大小合适
      while (tools.length > 0 && JSON.stringify(compressedData).length > 95 * 1024) {
        const leastUsedTool = tools.pop();
        delete compressedData.tools[leastUsedTool.id];
      }
    }
    
    return compressedData;
  }
  
  // 压缩Base64图像
  function compressBase64Image(base64String) {
    // 如果已经很小，直接返回
    if (base64String.length < 10 * 1024) return base64String;
    
    // 否则使用预设图标替代
    return 'fas fa-folder';
  }
  
  // 渲染当前文件夹内容
  async function renderCurrentFolder(data) {
    toolsList.innerHTML = '';
    
    // 更新文件夹选择器
    updateFolderSelect(data.folders);
    
    // 渲染该文件夹下的子文件夹
    Object.values(data.folders)
      .filter(folder => folder.parent === currentFolderId)
      .forEach(folder => {
        const folderElement = createFolderElement(folder);
        toolsList.appendChild(folderElement);
      });
    
    // 渲染该文件夹下的工具
    Object.values(data.tools)
      .filter(tool => tool.folderId === currentFolderId)
      .forEach(tool => {
        const toolElement = createToolElement(tool);
        toolsList.appendChild(toolElement);
      });
  }
  
  // 更新面包屑导航
  function updateBreadcrumb() {
    breadcrumb.innerHTML = '';
    
    breadcrumbPath.forEach((item, index) => {
      const breadcrumbItem = document.createElement('div');
      breadcrumbItem.className = 'breadcrumb-item';
      breadcrumbItem.textContent = item.name;
      breadcrumbItem.dataset.id = item.id;
      
      breadcrumbItem.addEventListener('click', () => {
        // 导航到此文件夹
        currentFolderId = item.id;
        // 更新面包屑路径
        breadcrumbPath = breadcrumbPath.slice(0, index + 1);
        loadData().then(data => {
          renderCurrentFolder(data);
          updateBreadcrumb();
        });
      });
      
      breadcrumb.appendChild(breadcrumbItem);
      
      // 添加分隔符（除了最后一项）
      if (index < breadcrumbPath.length - 1) {
        const separator = document.createElement('div');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '>';
        breadcrumb.appendChild(separator);
      }
    });
  }
  
  // 创建文件夹元素
  function createFolderElement(folder) {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';
    folderDiv.dataset.id = folder.id;
    
    const folderIcon = document.createElement('div');
    folderIcon.className = 'folder-icon';
    
    // 根据图标类型创建图标
    if (folder.iconType === 'custom' && folder.customIcon) {
      const img = document.createElement('img');
      img.src = folder.customIcon;
      img.onerror = function() {
        folderIcon.innerHTML = `<i class="fas fa-folder"></i>`;
      };
      folderIcon.appendChild(img);
    } else {
      folderIcon.innerHTML = `<i class="${folder.icon || 'fas fa-folder'}"></i>`;
    }
    
    const folderName = document.createElement('div');
    folderName.className = 'folder-name';
    folderName.textContent = folder.name;
    
    folderDiv.appendChild(folderIcon);
    folderDiv.appendChild(folderName);
    
    // 双击打开文件夹
    folderDiv.addEventListener('dblclick', () => {
      openFolder(folder);
    });
    
    // 单击选中
    folderDiv.addEventListener('click', (e) => {
      selectItem(folderDiv);
    });
    
    // 右键菜单
    folderDiv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectItem(folderDiv);
      showFolderContextMenu(e, folder);
    });
    
    // 拖拽功能
    folderDiv.setAttribute('draggable', 'true');
    folderDiv.addEventListener('dragstart', (e) => {
      draggedItem = {
        type: 'folder',
        id: folder.id
      };
      e.dataTransfer.setData('text/plain', folder.id);
      setTimeout(() => {
        folderDiv.classList.add('dragging');
      }, 0);
    });
    
    folderDiv.addEventListener('dragend', () => {
      folderDiv.classList.remove('dragging');
    });
    
    folderDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      folderDiv.classList.add('drag-over');
    });
    
    folderDiv.addEventListener('dragleave', () => {
      folderDiv.classList.remove('drag-over');
    });
    
    folderDiv.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      folderDiv.classList.remove('drag-over');
      
      if (draggedItem && draggedItem.id !== folder.id) {
        const data = await loadData();
        
        // 移动文件夹或工具到此文件夹
        if (draggedItem.type === 'folder') {
          // 检查是否会导致循环引用
          if (!wouldCreateCycle(data.folders, draggedItem.id, folder.id)) {
            data.folders[draggedItem.id].parent = folder.id;
            console.log(`移动文件夹 ${draggedItem.id} 到 ${folder.id}`);
          } else {
            console.warn('检测到循环引用，取消移动');
          }
        } else if (draggedItem.type === 'tool') {
          data.tools[draggedItem.id].folderId = folder.id;
          console.log(`移动工具 ${draggedItem.id} 到 ${folder.id}`);
        }
        
        await saveData(data);
        renderCurrentFolder(data);
      }
      
      draggedItem = null;
    });
    
    return folderDiv;
  }
  
  // 创建工具元素
  function createToolElement(tool) {
    const toolDiv = document.createElement('div');
    toolDiv.className = 'tool';
    toolDiv.dataset.id = tool.id;
    
    const toolIcon = document.createElement('img');
    toolIcon.className = 'tool-icon';
    toolIcon.src = tool.icon || 'images/icon16.png';
    toolIcon.onerror = function() {
      this.src = 'images/icon16.png';
    };
    
    const toolName = document.createElement('div');
    toolName.className = 'tool-name';
    toolName.textContent = tool.name;
    
    toolDiv.appendChild(toolIcon);
    toolDiv.appendChild(toolName);
    
    // 双击打开工具
    toolDiv.addEventListener('dblclick', () => {
      openTool(tool);
    });
    
    // 单击选中
    toolDiv.addEventListener('click', () => {
      selectItem(toolDiv);
    });
    
    // 右键菜单
    toolDiv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectItem(toolDiv);
      showToolContextMenu(e, tool);
    });
    
    // 拖拽功能
    toolDiv.setAttribute('draggable', 'true');
    toolDiv.addEventListener('dragstart', (e) => {
      draggedItem = {
        type: 'tool',
        id: tool.id
      };
      e.dataTransfer.setData('text/plain', tool.id);
      setTimeout(() => {
        toolDiv.classList.add('dragging');
      }, 0);
    });
    
    toolDiv.addEventListener('dragend', () => {
      toolDiv.classList.remove('dragging');
    });
    
    return toolDiv;
  }
  
  // 检查是否会导致循环引用
  function wouldCreateCycle(folders, folderId, targetFolderId) {
    let current = targetFolderId;
    const visited = new Set();
    
    while (current && current !== 'root') {
      if (visited.has(current)) return true;
      if (current === folderId) return true;
      
      visited.add(current);
      current = folders[current]?.parent;
    }
    
    return false;
  }
  
  // 选中项目
  function selectItem(element) {
    // 取消之前的选中
    if (selectedItem) {
      selectedItem.classList.remove('selected');
    }
    
    // 选中当前项
    element.classList.add('selected');
    selectedItem = element;
  }
  
  // 打开文件夹
  function openFolder(folder) {
    currentFolderId = folder.id;
    breadcrumbPath.push({ id: folder.id, name: folder.name });
    
    loadData().then(data => {
      renderCurrentFolder(data);
      updateBreadcrumb();
    });
  }
  
  // 打开工具
  function openTool(tool) {
    // 更新最后访问时间
    updateToolLastAccessed(tool.id);
    
    // 打开网页
    chrome.tabs.create({ url: tool.url });
  }
  
  // 更新文件夹选择器
  function updateFolderSelect(folders) {
    // 清除现有选项，保留根目录选项
    while (folderSelect.options.length > 1) {
      folderSelect.remove(1);
    }
    
    // 添加文件夹选项
    const addFolderOptions = (parentId, level = 0) => {
      Object.values(folders)
        .filter(folder => folder.parent === parentId)
        .forEach(folder => {
          const option = document.createElement('option');
          option.value = folder.id;
          option.textContent = '　'.repeat(level) + folder.name;
          folderSelect.appendChild(option);
          
          // 递归添加子文件夹
          addFolderOptions(folder.id, level + 1);
        });
    };
    
    addFolderOptions('root');
  }
  
  // 显示桌面右键菜单
  function showDesktopContextMenu(e) {
    const menuItems = [
      { icon: 'fas fa-plus', text: '添加工具', action: showAddToolModal },
      { icon: 'fas fa-folder-plus', text: '新建文件夹', action: showAddFolderModal },
      { icon: 'fas fa-sync-alt', text: '刷新', action: refreshCurrentFolder }
    ];
    
    showContextMenu(e, menuItems);
  }
  
  // 显示文件夹右键菜单
  function showFolderContextMenu(e, folder) {
    const menuItems = [
      { icon: 'fas fa-folder-open', text: '打开', action: () => openFolder(folder) },
      { icon: 'fas fa-edit', text: '编辑', action: () => showEditFolderModal(folder) },
      { icon: 'fas fa-trash-alt', text: '删除', action: () => deleteFolder(folder.id) }
    ];
    
    showContextMenu(e, menuItems);
  }
  
  // 显示工具右键菜单
  function showToolContextMenu(e, tool) {
    const menuItems = [
      { icon: 'fas fa-external-link-alt', text: '打开', action: () => openTool(tool) },
      { icon: 'fas fa-edit', text: '编辑', action: () => showEditToolModal(tool) },
      { icon: 'fas fa-trash-alt', text: '删除', action: () => deleteTool(tool.id) }
    ];
    
    showContextMenu(e, menuItems);
  }
  
  // 显示右键菜单
  function showContextMenu(e, items) {
    contextMenu.innerHTML = '';
    
    items.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      
      const icon = document.createElement('i');
      icon.className = item.icon;
      
      const text = document.createElement('span');
      text.textContent = item.text;
      
      menuItem.appendChild(icon);
      menuItem.appendChild(text);
      menuItem.addEventListener('click', () => {
        contextMenu.style.display = 'none';
        item.action();
      });
      
      contextMenu.appendChild(menuItem);
    });
    
    // 显示菜单
    contextMenu.style.display = 'block';
    
    // 调整位置
    const rect = toolsList.getBoundingClientRect();
    const x = Math.min(e.clientX, rect.right - contextMenu.offsetWidth - 5);
    const y = Math.min(e.clientY, rect.bottom - contextMenu.offsetHeight - 5);
    
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
  }
  
  // 刷新当前文件夹
  function refreshCurrentFolder() {
    loadData().then(data => {
      renderCurrentFolder(data);
    });
  }
  
  // 显示添加工具模态框
  function showAddToolModal() {
    // 重置表单
    modalTitle.textContent = '添加新工具';
    toolNameInput.value = '';
    toolUrlInput.value = '';
    toolIconInput.value = '';
    toolIconPreview.innerHTML = '';
    folderSelect.value = currentFolderId;
    editingItemId = null;
    
    // 获取当前标签页信息
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        toolNameInput.value = currentTab.title || '';
        toolUrlInput.value = currentTab.url || '';
        toolIconInput.value = currentTab.favIconUrl || '';
        updateToolIconPreview();
      }
    });
    
    showModal(toolModal);
  }
  
  // 显示编辑工具模态框
  function showEditToolModal(tool) {
    modalTitle.textContent = '编辑工具';
    toolNameInput.value = tool.name || '';
    toolUrlInput.value = tool.url || '';
    toolIconInput.value = tool.icon || '';
    folderSelect.value = tool.folderId || currentFolderId;
    editingItemId = tool.id;
    
    updateToolIconPreview();
    showModal(toolModal);
  }
  
  // 显示添加文件夹模态框
  function showAddFolderModal() {
    folderModalTitle.textContent = '新建文件夹';
    folderNameInput.value = '';
    folderIconClass.value = 'fas fa-folder';
    folderIconType.value = 'preset';
    folderIconData.value = '';
    folderIconUrl.value = '';
    folderIconFile.value = '';
    folderIconPreview.innerHTML = '';
    editingItemId = null;
    
    // 显示预设图标标签页
    document.querySelector('.icon-tab[data-tab="preset"]').click();
    
    // 重置图标选择
    document.querySelector('.icon-option.selected')?.classList.remove('selected');
    document.querySelector('.icon-option[data-icon="fas fa-folder"]').classList.add('selected');
    
    showModal(folderModal);
  }
  
  // 显示编辑文件夹模态框
  function showEditFolderModal(folder) {
    folderModalTitle.textContent = '编辑文件夹';
    folderNameInput.value = folder.name || '';
    editingItemId = folder.id;
    
    // 根据文件夹的图标类型显示不同的标签页
    if (folder.iconType === 'custom' && folder.customIcon) {
      folderIconType.value = 'custom';
      folderIconData.value = folder.customIcon;
      folderIconUrl.value = folder.customIcon.startsWith('data:') ? '' : folder.customIcon;
      folderIconFile.value = '';
      updateFolderIconPreviewElement(folder.customIcon);
      
      // 显示自定义图标标签页
      document.querySelector('.icon-tab[data-tab="custom"]').click();
    } else {
      folderIconType.value = 'preset';
      folderIconClass.value = folder.icon || 'fas fa-folder';
      folderIconData.value = '';
      
      // 显示预设图标标签页
      document.querySelector('.icon-tab[data-tab="preset"]').click();
      
      // 设置当前图标选择
      updateSelectedPresetIcon(folder.icon || 'fas fa-folder');
    }
    
    showModal(folderModal);
  }
  
  // 显示模态框
  function showModal(modal) {
    modal.style.display = 'flex';
  }
  
  // 隐藏模态框
  function hideModal(modal) {
    modal.style.display = 'none';
  }
  
  // 保存工具更改
  async function saveToolChanges() {
    const name = toolNameInput.value.trim();
    const url = toolUrlInput.value.trim();
    const icon = toolIconInput.value.trim();
    const folderId = folderSelect.value;
    
    if (!name || !url) {
      alert('请填写工具名称和网址');
      return;
    }
    
    const data = await loadData();
    
    if (editingItemId) {
      // 编辑现有工具
      data.tools[editingItemId] = {
        ...data.tools[editingItemId],
        name,
        url,
        icon,
        folderId
      };
    } else {
      // 添加新工具
      const toolId = 'tool_' + Date.now();
      data.tools[toolId] = {
        id: toolId,
        name,
        url,
        icon,
        folderId
      };
    }
    
    await saveData(data);
    hideModal(toolModal);
    renderCurrentFolder(data);
  }
  
  // 保存文件夹更改
  async function saveFolderChanges() {
    const name = folderNameInput.value.trim();
    const iconType = folderIconType.value;
    let icon, customIcon;
    
    if (!name) {
      alert('请填写文件夹名称');
      return;
    }
    
    // 根据图标类型获取图标数据
    if (iconType === 'preset') {
      icon = folderIconClass.value;
      customIcon = '';
    } else {
      icon = 'fas fa-folder'; // 默认图标类名
      customIcon = folderIconData.value;
      
      if (!customIcon) {
        alert('请选择或上传自定义图标');
        return;
      }
    }
    
    const data = await loadData();
    
    if (editingItemId) {
      // 编辑现有文件夹
      data.folders[editingItemId] = {
        ...data.folders[editingItemId],
        name,
        icon,
        iconType,
        customIcon
      };
      
      // 如果正在编辑的文件夹在面包屑路径中，更新面包屑
      const breadcrumbIndex = breadcrumbPath.findIndex(item => item.id === editingItemId);
      if (breadcrumbIndex !== -1) {
        breadcrumbPath[breadcrumbIndex].name = name;
      }
    } else {
      // 添加新文件夹
      const folderId = 'folder_' + Date.now();
      data.folders[folderId] = {
        id: folderId,
        name,
        icon,
        iconType,
        customIcon,
        parent: currentFolderId
      };
    }
    
    await saveData(data);
    hideModal(folderModal);
    renderCurrentFolder(data);
    updateBreadcrumb();
  }
  
  // 删除文件夹
  async function deleteFolder(folderId) {
    if (!confirm('确定要删除此文件夹及其内容吗?')) return;
    
    const data = await loadData();
    
    // 递归删除子文件夹及其内容
    function deleteSubFolders(parentId) {
      Object.values(data.folders).forEach(folder => {
        if (folder.parent === parentId) {
          deleteSubFolders(folder.id);
          delete data.folders[folder.id];
        }
      });
      
      // 删除该文件夹中的工具
      Object.values(data.tools).forEach(tool => {
        if (tool.folderId === parentId) {
          delete data.tools[tool.id];
        }
      });
    }
    
    deleteSubFolders(folderId);
    delete data.folders[folderId];
    
    await saveData(data);
    renderCurrentFolder(data);
  }
  
  // 删除工具
  async function deleteTool(toolId) {
    if (!confirm('确定要删除此工具吗?')) return;
    
    const data = await loadData();
    delete data.tools[toolId];
    
    await saveData(data);
    renderCurrentFolder(data);
  }
  
  // 更新选中的预设图标
  function updateSelectedPresetIcon(iconClass) {
    // 移除之前的选中状态
    document.querySelector('.icon-option.selected')?.classList.remove('selected');
    // 设置新的选中状态
    const option = document.querySelector(`.icon-option[data-icon="${iconClass}"]`);
    if (option) {
      option.classList.add('selected');
    }
    // 更新隐藏输入框的值
    folderIconClass.value = iconClass;
  }
  
  // 处理文件夹图标上传
  function handleFolderIconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.match('image.*')) {
      alert('请选择图片文件');
      return;
    }
    
    // 检查文件大小 (限制为500KB)
    if (file.size > 500 * 1024) {
      alert('图片大小不能超过500KB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const imageData = e.target.result;
      folderIconData.value = imageData;
      updateFolderIconPreviewElement(imageData);
    };
    reader.readAsDataURL(file);
  }
  
  // 更新工具图标预览
  function updateToolIconPreview() {
    const iconUrl = toolIconInput.value.trim();
    if (!iconUrl) {
      toolIconPreview.innerHTML = '';
      return;
    }
    
    const img = document.createElement('img');
    img.src = iconUrl;
    img.onerror = function() {
      toolIconPreview.innerHTML = '<span style="color: #f44336;">图标加载失败</span>';
    };
    img.onload = function() {
      toolIconPreview.innerHTML = '';
      toolIconPreview.appendChild(img);
    };
  }
  
  // 更新文件夹图标预览
  function updateFolderIconPreview() {
    const iconUrl = folderIconUrl.value.trim();
    if (!iconUrl) {
      folderIconPreview.innerHTML = '';
      folderIconData.value = '';
      return;
    }
    
    folderIconData.value = iconUrl;
    updateFolderIconPreviewElement(iconUrl);
  }
  
  // 更新文件夹图标预览元素
  function updateFolderIconPreviewElement(iconSrc) {
    folderIconPreview.innerHTML = '';
    
    if (!iconSrc) return;
    
    const img = document.createElement('img');
    img.src = iconSrc;
    img.onerror = function() {
      folderIconPreview.innerHTML = '<span style="color: #f44336;">图标加载失败</span>';
    };
    img.onload = function() {
      folderIconPreview.innerHTML = '';
      folderIconPreview.appendChild(img);
    };
  }
  
  // 获取网页信息
  function fetchWebpageInfo() {
    const url = toolUrlInput.value.trim();
    if (!url) {
      alert('请输入网址');
      return;
    }
    
    // 显示加载状态
    fetchInfoBtn.disabled = true;
    fetchInfoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // 使用当前标签页获取信息
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      try {
        if (tabs.length > 0) {
          const currentTab = tabs[0];
          
          // 如果输入的URL与当前标签页URL匹配，直接使用当前标签页信息
          if (url === currentTab.url) {
            toolNameInput.value = currentTab.title || '';
            toolIconInput.value = currentTab.favIconUrl || '';
            updateToolIconPreview();
          } else {
            // 否则尝试通过后台脚本获取网页信息
            // 由于Chrome扩展的安全限制，我们无法直接获取其他网页的信息
            // 这里只是一个简化的示例，提示用户访问该网页后再尝试
            alert('请先访问该网页，然后再点击"获取网页信息"按钮');
          }
        }
      } catch (error) {
        console.error('获取网页信息失败:', error);
        alert('获取网页信息失败，请手动输入');
      } finally {
        // 恢复按钮状态
        fetchInfoBtn.disabled = false;
        fetchInfoBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
      }
    });
  }
  
  // 拖拽事件处理
  function setupDragEvents() {
    // 清除现有的拖拽事件监听器
    toolsList.removeEventListener('dragover', handleDragOver);
    toolsList.removeEventListener('drop', handleDrop);
    toolsList.removeEventListener('dragleave', handleDragLeave);
    
    // 添加新的拖拽事件监听器
    toolsList.addEventListener('dragover', handleDragOver);
    toolsList.addEventListener('drop', handleDrop);
    toolsList.addEventListener('dragleave', handleDragLeave);
    
    // 添加拖拽开始和结束的全局监听
    document.addEventListener('dragstart', () => {
      document.body.classList.add('dragging-active');
    });
    
    document.addEventListener('dragend', () => {
      document.body.classList.remove('dragging-active');
    });
  }
  
  // 处理拖拽经过事件
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 添加视觉反馈
    if (e.target.closest('#toolsList') && !e.target.closest('.folder') && !e.target.closest('.tool')) {
      toolsList.classList.add('drag-over');
    }
  }
  
  // 处理拖拽离开事件
  function handleDragLeave(e) {
    if (!e.relatedTarget || !toolsList.contains(e.relatedTarget)) {
      toolsList.classList.remove('drag-over');
    }
  }
  
  // 处理放置事件
  async function handleDrop(e) {
    e.preventDefault();
    
    // 移除所有拖拽相关的视觉样式
    toolsList.classList.remove('drag-over');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    if (!draggedItem) return;
    
    const data = await loadData();
    
    // 将拖拽的项目移动到当前文件夹
    if (draggedItem.type === 'folder') {
      // 检查是否会导致循环引用
      if (!wouldCreateCycle(data.folders, draggedItem.id, currentFolderId)) {
        data.folders[draggedItem.id].parent = currentFolderId;
        console.log(`移动文件夹 ${draggedItem.id} 到 ${currentFolderId}`);
        
        // 添加动画效果
        const element = document.querySelector(`.folder[data-id="${draggedItem.id}"]`);
        if (element) {
          element.classList.add('drop-animation');
          setTimeout(() => {
            element.classList.remove('drop-animation');
          }, 500);
        }
      } else {
        console.warn('检测到循环引用，取消移动');
        showNotification('无法移动：不能将文件夹移动到其子文件夹中', 'error');
      }
    } else if (draggedItem.type === 'tool') {
      data.tools[draggedItem.id].folderId = currentFolderId;
      console.log(`移动工具 ${draggedItem.id} 到 ${currentFolderId}`);
      
      // 添加动画效果
      const element = document.querySelector(`.tool[data-id="${draggedItem.id}"]`);
      if (element) {
        element.classList.add('drop-animation');
        setTimeout(() => {
          element.classList.remove('drop-animation');
        }, 500);
      }
    }
    
    await saveData(data);
    renderCurrentFolder(data);
    draggedItem = null;
  }
  
  // 显示通知消息
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 自动关闭
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // 更新工具最后访问时间
  async function updateToolLastAccessed(toolId) {
    const data = await loadData();
    if (data.tools[toolId]) {
      data.tools[toolId].lastAccessed = Date.now();
      
      // 使用chrome.storage.local保存访问历史，避免频繁写入同步存储
      chrome.storage.local.set({
        toolHistory: {
          [toolId]: Date.now()
        }
      });
      
      // 每10次访问才同步一次完整数据，减少写入次数
      chrome.storage.local.get('accessCount', (result) => {
        const count = (result.accessCount || 0) + 1;
        chrome.storage.local.set({ accessCount: count });
        
        if (count % 10 === 0) {
          saveData(data).catch(err => console.error('保存数据失败:', err));
        }
      });
    }
  }
  
  // 同步本地访问历史到同步存储
  async function syncAccessHistory() {
    chrome.storage.local.get('toolHistory', async (result) => {
      if (result.toolHistory) {
        const data = await loadData();
        let updated = false;
        
        Object.entries(result.toolHistory).forEach(([toolId, timestamp]) => {
          if (data.tools[toolId] && (!data.tools[toolId].lastAccessed || data.tools[toolId].lastAccessed < timestamp)) {
            data.tools[toolId].lastAccessed = timestamp;
            updated = true;
          }
        });
        
        if (updated) {
          saveData(data).then(() => {
            // 清除本地历史
            chrome.storage.local.remove('toolHistory');
          }).catch(err => console.error('同步访问历史失败:', err));
        }
      }
    });
  }
}); 