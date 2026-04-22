export const globalStubs = {
  SpeakButton: { template: '<button class="speak-stub" />' },
  SessionProgress: { template: '<div class="progress-stub" />' },
  'el-button': {
    props: ['loading'],
    emits: ['click'],
    template: '<button class="el-btn" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-input': {
    props: ['modelValue', 'size', 'placeholder', 'type', 'showPassword', 'disabled'],
    emits: ['update:modelValue'],
    methods: {
      focus() {},
    },
    template:
      '<div class="el-input-stub"><input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
  },
  'el-alert': { template: '<div class="el-alert-stub"><slot /><slot name="default" /></div>' },
  'el-progress': true,
};