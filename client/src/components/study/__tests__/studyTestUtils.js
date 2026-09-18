export const globalStubs = {
  SpeakButton: { template: '<button class="speak-stub" />' },
  SessionProgress: { template: '<div class="progress-stub"><slot name="extra" /></div>' },
  'el-button': {
    props: ['loading'],
    emits: ['click'],
    // 与真实 el-button 一致，把原生事件透传给 $emit，供 .stop 等修饰符使用
    template:
      '<button class="el-btn" :data-loading="loading" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  'el-input': {
    props: ['modelValue', 'size', 'placeholder', 'type', 'showPassword', 'disabled'],
    emits: ['update:modelValue'],
    methods: {
      focus() {},
    },
    template:
      '<div class="el-input-stub"><input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><slot name="append" /></div>',
  },
  'el-alert': { template: '<div class="el-alert-stub"><slot /><slot name="default" /></div>' },
  'el-progress': true,
};
