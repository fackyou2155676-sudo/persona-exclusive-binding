/*
 * Persona Filter | 面具过滤
 * 隐藏绑定了其他角色的 User Persona，只显示：
 *   1. 没有绑定任何角色的面具
 *   2. 绑定了当前角色/群组的面具
 */

(function () {
    const EXT_NAME = 'persona-exclusive-binding';

    // 获取当前角色/群组的 connection 标识
    function getCurrentTarget() {
        const ctx = SillyTavern.getContext();
        if (ctx.groupId) {
            return { type: 'group', id: ctx.groupId };
        }
        const chid = ctx.characterId;
        if (chid !== undefined && chid !== null && ctx.characters && ctx.characters[chid]) {
            return { type: 'character', id: ctx.characters[chid].avatar };
        }
        return null;
    }

    // 获取面具的绑定 connections
    function getPersonaConnections(avatarId) {
        try {
            const ctx = SillyTavern.getContext();
            const pd = ctx.powerUserSettings?.persona_descriptions;
            if (!pd) return null;
            const desc = pd[avatarId];
            if (!desc || !desc.connections || desc.connections.length === 0) {
                return null;
            }
            return desc.connections;
        } catch (e) {
            console.error(`[${EXT_NAME}] getPersonaConnections error:`, e);
            return null;
        }
    }

    // 核心过滤逻辑
    function filterPersonas() {
        const block = document.getElementById('user_avatar_block');
        if (!block) return;

        const target = getCurrentTarget();
        const items = block.querySelectorAll('[data-avatar-id]');

        items.forEach(item => {
            const avatarId = item.getAttribute('data-avatar-id');
            if (!avatarId) return;

            const connections = getPersonaConnections(avatarId);

            // 没有绑定任何角色 → 始终显示
            if (!connections || connections.length === 0) {
                item.style.removeProperty('display');
                return;
            }

            // 没有打开任何角色/群组 → 有绑定的全部隐藏
            if (!target) {
                item.style.display = 'none';
                return;
            }

            // 检查是否绑定了当前角色/群组
            const matchesCurrent = connections.some(conn =>
                conn.type === target.type && conn.id === target.id
            );

            if (matchesCurrent) {
                item.style.removeProperty('display');
            } else {
                item.style.display = 'none';
            }
        });
    }

    // 防抖
    let debounceTimer = null;
    function debouncedFilter() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterPersonas, 200);
    }

    // 初始化
    function init() {
        console.log(`[${EXT_NAME}] 面具过滤扩展已加载`);

        // 监听面具列表 DOM 变化
        const observer = new MutationObserver(debouncedFilter);
        const startObserving = () => {
            const block = document.getElementById('user_avatar_block');
            if (block) {
                observer.observe(block, { childList: true, subtree: true });
                filterPersonas();
            } else {
                setTimeout(startObserving, 500);
            }
        };
        startObserving();

        // 监听酒馆事件
        const ctx = SillyTavern.getContext();
        if (ctx.eventSource) {
            const events = [
                'chatLoaded',
                'chat_id_changed',
                'character_page_loaded',
                'group_chat_created',
                'group_chat_loaded',
                'personaDescriptionUpdate',
            ];
            events.forEach(evt => {
                try {
                    ctx.eventSource.on(evt, debouncedFilter);
                } catch (e) { /* 事件不存在就跳过 */ }
            });
        }

        // 点击角色列表时触发
        document.addEventListener('click', (e) => {
            if (e.target.closest('.character_select') ||
                e.target.closest('.group_select') ||
                e.target.closest('#rm_button_characters') ||
                e.target.closest('#rm_button_group_chats')) {
                setTimeout(filterPersonas, 500);
                setTimeout(filterPersonas, 1000);
            }
        });

        // 定时兜底，保证切换角色后一定能过滤
        setInterval(filterPersonas, 2000);
    }

    // 等待 DOM 就绪
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
